import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

/**
 * Exact SQL privacy test for Supabase's published SOV identity projection.
 * The browser PGlite kernel must NOT load this managed-auth migration.
 * Only this test fixture provides the minimal auth.users + auth.uid() dependency.
 */
const publishedId = "ad0ca8ae-e206-4d1c-a3b5-2b8e3cb714fd";
const hiddenId = "bc0ca8ae-e206-4d1c-a3b5-2b8e3cb714fd";
const ownerId = "10000000-0000-4000-8000-000000000001";
const hiddenOwnerId = "10000000-0000-4000-8000-000000000002";
const visitorId = "10000000-0000-4000-8000-000000000003";
type Role = "anon" | "authenticated";

async function asRole<T extends Record<string, unknown>>(
  db: PGlite, role: Role, sub: string | null, sql: string, params: unknown[] = [], options: { isAnonymous?: boolean } = {},
): Promise<T[]> {
  return db.transaction(async tx => {
    await tx.exec("set local role " + role);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({
      sub: sub ?? "", role, is_anonymous: options.isAnonymous === true,
    })]);
    return (await tx.query<T>(sql, params)).rows;
  });
}

async function fixture() {
  const db = new PGlite();
  // Supabase-managed functions are emulated only inside this test database.
  await db.exec([
    "create schema auth;",
    "create table auth.users (id uuid primary key);",
    "create function auth.uid() returns uuid language sql stable as $$",
    "  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid",
    "$$;",
    "create function auth.jwt() returns jsonb language sql stable as $",
    "  select nullif(current_setting('request.jwt.claims', true), '')::jsonb",
    "$;",
    "create role anon nologin;",
    "create role authenticated nologin;",
    "grant usage on schema public to anon, authenticated;",
    "grant usage on schema auth to authenticated;",
    "grant execute on function auth.uid() to authenticated;",
    "grant execute on function auth.jwt() to authenticated;",
  ].join("\n"));

  const migration = readFileSync("supabase/migrations/20261108074034_sov_public_identity.sql", "utf8");
  await db.exec(migration);
  await db.exec(readFileSync("supabase/migrations/20261108074837_sov_card_permanent_account_publishing.sql", "utf8"));
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [
    ownerId, hiddenOwnerId, visitorId,
  ]);
  await db.query(
    "insert into public.sov_public_profiles " +
    "(owner_id, public_id, display_name, public_email, website, published) values " +
    "($1, $2, 'Public Person', 'public@example.com', 'https://example.com', true), " +
    "($3, $4, 'Hidden Person', 'private@example.com', 'https://private.example', false)",
    [ownerId, publishedId, hiddenOwnerId, hiddenId],
  );
  return db;
}

test("true anon sees published SOV fields, not drafts, owner IDs or write access", async () => {
  const db = await fixture();
  try {
    // Same SELECT predicate and public columns used by the actual server page.
    const allowed = await asRole(db, "anon", null,
      "select public_id, display_name, handle, tagline, about, public_email, " +
      "website, featured_url, appearance from public.sov_public_profiles " +
      "where public_id = $1 and published = true", [publishedId]);
    assert.equal(allowed.length, 1);
    assert.equal(allowed[0].display_name, "Public Person");
    assert.equal(allowed[0].public_email, "public@example.com");

    const hidden = await asRole(db, "anon", null,
      "select public_id from public.sov_public_profiles where public_id = $1 and published = true",
      [hiddenId]);
    assert.deepEqual(hidden, []);

    const visible = await asRole(db, "anon", null, "select public_id from public.sov_public_profiles");
    assert.deepEqual(visible.map(row => row.public_id), [publishedId]);

    await assert.rejects(
      asRole(db, "anon", null, "select owner_id from public.sov_public_profiles"),
      (error: unknown) => (error as { code?: string }).code === "42501",
    );
    await assert.rejects(
      asRole(db, "anon", null,
        "insert into public.sov_public_profiles (owner_id, display_name) values ($1, 'Illegal')",
        [visitorId]),
      (error: unknown) => (error as { code?: string }).code === "42501",
    );
  } finally {
    await db.close();
  }
});

test("owners can revoke; strangers cannot mutate or see unpublished cards", async () => {
  const db = await fixture();
  try {
    const publicForOther = await asRole(db, "authenticated", visitorId,
      "select public_id from public.sov_public_profiles where public_id = $1", [publishedId]);
    assert.equal(publicForOther.length, 1);

    const draftForOther = await asRole(db, "authenticated", visitorId,
      "select public_id from public.sov_public_profiles where public_id = $1", [hiddenId]);
    assert.deepEqual(draftForOther, []);

    const attemptedUpdate = await asRole(db, "authenticated", visitorId,
      "update public.sov_public_profiles set published = false where public_id = $1 returning public_id",
      [publishedId]);
    assert.deepEqual(attemptedUpdate, []);

    await assert.rejects(
      asRole(db, "authenticated", visitorId,
        "insert into public.sov_public_profiles (owner_id, display_name) values ($1, 'Impersonated')",
        [ownerId]),
      (error: unknown) => (error as { code?: string }).code === "42501",
    );

    const ownerCanReadDraft = await asRole(db, "authenticated", hiddenOwnerId,
      "select public_id from public.sov_public_profiles where public_id = $1", [hiddenId]);
    assert.equal(ownerCanReadDraft.length, 1);

    const revoked = await asRole(db, "authenticated", ownerId,
      "update public.sov_public_profiles set published = false where public_id = $1 returning public_id",
      [publishedId]);
    assert.equal(revoked.length, 1);

    const afterRevoke = await asRole(db, "anon", null,
      "select public_id from public.sov_public_profiles where public_id = $1 and published = true",
      [publishedId]);
    assert.deepEqual(afterRevoke, []);

    const ownerStillCanRead = await asRole(db, "authenticated", ownerId,
      "select public_id from public.sov_public_profiles where public_id = $1", [publishedId]);
    assert.equal(ownerStillCanRead.length, 1);
  } finally {
    await db.close();
  }
});


test("signed-in anonymous users cannot directly publish, edit or revoke an identity", async () => {
  const db = await fixture();
  try {
    const anonymous = { isAnonymous: true };
    await assert.rejects(
      asRole(db, "authenticated", visitorId,
        "insert into public.sov_public_profiles (owner_id, display_name, published) values ($1, 'Bypass', true)",
        [visitorId], anonymous),
      (error: unknown) => (error as { code?: string }).code === "42501",
    );

    // Guests may still read an explicitly published card, but cannot change one.
    const publicRead = await asRole(db, "authenticated", ownerId,
      "select public_id from public.sov_public_profiles where public_id = $1", [publishedId], anonymous);
    assert.equal(publicRead.length, 1);
    const unauthorizedEdit = await asRole(db, "authenticated", ownerId,
      "update public.sov_public_profiles set published = false where public_id = $1 returning public_id",
      [publishedId], anonymous);
    assert.deepEqual(unauthorizedEdit, []);
    const unauthorizedDelete = await asRole(db, "authenticated", ownerId,
      "delete from public.sov_public_profiles where public_id = $1 returning public_id",
      [publishedId], anonymous);
    assert.deepEqual(unauthorizedDelete, []);

    const permanentOwner = await asRole(db, "authenticated", ownerId,
      "update public.sov_public_profiles set published = false where public_id = $1 returning public_id",
      [publishedId]);
    assert.equal(permanentOwner.length, 1);
  } finally {
    await db.close();
  }
});
