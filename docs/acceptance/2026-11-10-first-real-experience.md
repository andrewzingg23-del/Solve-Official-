# The first real SOLVE experience — two real people

Automated runs (206/206 on staging) prove that SOLVE behaves and refuses correctly. They cannot show
whether anyone would enjoy it, or swap a link-in-bio for it. This test can. It is run by the founder
and his brother, for real, and its results are recorded as **human evidence**, which nothing
automated may stand in for.

**Where:** https://solve-git-solve-from-zero-sovigrn.vercel.app — the latest build of the rebuilt
SOLVE, running against **staging**. Staging is real storage, but not production: what you make here
is not on solve's live site, and moving to production is a separate decision.

**What you need:** two phones (yours and your brother's), a third phone or a friend's for step 5, and
a few of your own photos.

## The six steps

| # | Do this | It worked if | Watch for |
|---|---|---|---|
| 1 | Open the link on your phone. Go to **ID**, give your card your name, and pick its look. | Your name and look are on the card, and they're still there after closing and reopening. | Anything confusing about what ID is. Whether you'd want to show the card to someone. |
| 2 | On **Home**, start something about you, e.g. "My work". Add photos and a line or two. Put links in your words, e.g. `Book me: https://…`. | Each photo and line appears, credited to You. | How long a photo takes to add. Whether photos look right way up. |
| 3 | **Invite a friend** → send the link to your brother. He opens it, presses **Join**, and adds something of his own. | He sees who invited him and to what, gets in with one press and no sign-up, and his piece shows as his on your phone. | Whether the invite message reads naturally in the app he received it in. |
| 4 | Back on yours: **Public page** → tick only what you want shown. Check the preview. **Share as a page**. | The preview matches what you meant. Your brother's piece is never offered. | Whether "only what you tick" feels clear, or worrying. |
| 5 | Copy the link into your Instagram bio. Open it **from a phone that has never used SOLVE**. | It opens with no sign-up, in your colours, showing exactly what you ticked. The links work. | The first two seconds: does it look like yours, and like something worth tapping? |
| 6 | **The next day**, open SOLVE again on the same phone and keep building. Then try your other device. | Everything is where you left it on the same phone. | The second device: see below. |

## What we already know will be rough — say so if it is

- **A second device.** Without signing in by email, your SOLVE lives in this one browser. Signing in
  by email on the second device is what carries it across. The iPhone sign-in issue reported earlier
  may still be there, and this is the test that will show it.
- **Instagram's in-app browser** is a separate browser from Safari. Opening your own page inside
  Instagram will show it as a visitor sees it, which is the point of step 5.
- **Stop sharing** takes the page down at once. A photo someone already had open can keep loading
  for up to 10 minutes, and anything someone saved or screenshotted can't be taken back.
- **Many new visitors from one Wi-Fi network** can hit staging's guest limit, about 30 an hour.

## Recording it

For each step: worked / didn't / confusing, plus one sentence in your own words. Screenshots of
anything odd. Your words go into `docs/acceptance/STATUS.md` as **Verified by real human**, with the
date and who did it. Anything that failed becomes the next thing fixed, before anything new is built.

The milestone this exists for: someone saying, "I made this on SOLVE — here's my link."
