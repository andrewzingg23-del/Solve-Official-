-- The answer service's kernel path, exercised through kernel_api under the store's real roles
-- (run as postgres, which switches to the API roles the way PostgREST does). For a staging copy
-- only: it writes test actors and messages. Returns one row of checks.
--
-- An owner claims a market World and spawns its organization's agent; an asker sends a capability
-- query; the agent, under its own grant, answers in reply; replaying the same answer key returns
-- the same action; after its grant is revoked, the agent's next answer is a recorded refusal.
--
-- One DO block: roles and token claims are transaction-local (`set local`), so a pooled
-- connection is never left acting as an API role, and a failure rolls back everything.
do $$
declare
  owner_claims constant text := '{"role":"authenticated","sub":"staging-owner-0001"}';
  asker_claims constant text := '{"role":"authenticated","sub":"staging-asker-0001"}';
  service_claims constant text := '{"role":"service_role"}';
  v_owner uuid; v_asker uuid; v_agent uuid; v_agent_grant uuid;
  v_market text := 'world:staging-market-' || substr(md5(random()::text), 1, 8);
  v_query uuid; v_reply uuid; v_replay uuid; v_refused uuid;
  v_inbox int; v_answered text; v_seen text; v_refused_status text; v_chain boolean;
begin
  -- The owner signs in, claims the market, spawns the agent and lets it speak and read there.
  perform set_config('request.jwt.claims', owner_claims, true);
  set local role authenticated;
  v_owner := kernel_api.register('Staging org owner');
  perform kernel_api.claim_scope(v_market);
  v_agent := kernel_api.spawn_agent('Staging org agent', 'organization_agent');
  v_agent_grant := kernel_api.issue_grant(v_agent, 'message.send', v_market);
  perform kernel_api.issue_grant(v_agent, 'kernel.read', v_market);

  -- The asker signs in and is let in to speak and read in the market.
  perform set_config('request.jwt.claims', asker_claims, true);
  v_asker := kernel_api.register('Staging asker');
  perform set_config('request.jwt.claims', owner_claims, true);
  perform kernel_api.issue_grant(v_asker, 'message.send', v_market);
  perform kernel_api.issue_grant(v_asker, 'kernel.read', v_market);

  -- The asker sends a capability query to the agent.
  perform set_config('request.jwt.claims', asker_claims, true);
  v_query := kernel_api.propose_action(
    p_kind => 'message.send', p_capability => 'message.send', p_scope => v_market,
    p_payload => jsonb_build_object('type', 'CAPABILITY_QUERY', 'quantity', 10000),
    p_target_ref => 'actor:' || v_agent, p_idempotency_key => 'staging-query-1');
  perform kernel_api.enact_action(v_query);

  -- The agent (the service, as the agent) finds it in its inbox and answers in reply, once.
  reset role;
  perform set_config('request.jwt.claims', service_claims, true);
  set local role service_role;
  select count(*) into v_inbox from kernel_api.inbox(v_agent) i
  where i.action_id = v_query and i.message_type = 'CAPABILITY_QUERY';
  v_reply := kernel_api.propose_action(
    p_kind => 'message.send', p_capability => 'message.send', p_scope => v_market,
    p_payload => jsonb_build_object('type', 'INFORMATION_RESPONSE', 'can_fulfill', true, 'capacity_per_year', 12000),
    p_target_ref => 'actor:' || v_asker, p_in_reply_to => v_query,
    p_idempotency_key => 'answer:' || v_query, p_as_actor => v_agent);
  perform kernel_api.enact_action(v_reply, v_agent);
  -- A lost reply, retried: the same key returns the same action.
  v_replay := kernel_api.propose_action(
    p_kind => 'message.send', p_capability => 'message.send', p_scope => v_market,
    p_payload => jsonb_build_object('type', 'INFORMATION_RESPONSE', 'can_fulfill', true, 'capacity_per_year', 12000),
    p_target_ref => 'actor:' || v_asker, p_in_reply_to => v_query,
    p_idempotency_key => 'answer:' || v_query, p_as_actor => v_agent);
  select a.status into v_answered from kernel_api.read_actions(v_market, 100, v_agent) a
  where a.action_id = v_reply and a.in_reply_to = v_query;

  -- The asker sees the answer, with the agent's principal on it.
  reset role;
  perform set_config('request.jwt.claims', asker_claims, true);
  set local role authenticated;
  select coalesce(string_agg(i.on_behalf_of::text, ','), '') into v_seen from kernel_api.inbox() i where i.in_reply_to = v_query;

  -- The owner revokes the agent's speaking grant; its next answer is refused, and the refusal recorded.
  perform set_config('request.jwt.claims', owner_claims, true);
  perform kernel_api.revoke_grant(v_agent_grant, 'staging: speaking rights withdrawn');
  reset role;
  perform set_config('request.jwt.claims', service_claims, true);
  set local role service_role;
  v_refused := kernel_api.propose_action(
    p_kind => 'message.send', p_capability => 'message.send', p_scope => v_market,
    p_payload => jsonb_build_object('type', 'INFORMATION_RESPONSE', 'can_fulfill', false),
    p_target_ref => 'actor:' || v_asker, p_in_reply_to => v_query,
    p_idempotency_key => 'answer-2:' || v_query, p_as_actor => v_agent);
  select a.status into v_refused_status from kernel_api.read_action(v_refused, v_agent) a;
  select c.ok into v_chain from kernel_api.verify_chain() c;
  reset role;

  perform set_config('staging.service_path', jsonb_build_object(
    'query_delivered', v_inbox = 1,
    'replay_returns_same_action', v_replay = v_reply,
    'answer_status', v_answered,
    'asker_sees_answer_for_principal', v_seen = v_owner::text,
    'after_revocation', v_refused_status,
    'chain_ok', v_chain,
    'answer_actions', (select count(*) from kernel.actions where in_reply_to = v_query)
  )::text, true);
end
$$;
select current_setting('staging.service_path')::jsonb as checks;
