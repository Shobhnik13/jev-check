# Jev Check

**Live:** https://jev-check-five.vercel.app

Check photos automatically. Tell the app what a good photo should show, take a picture, and it tells you whether everything is there. Built on [Jev](https://typesafe.ai), TypeSafe's decision model.

Use it for things like: is every item in the order box, is the parcel at the door with its label visible, is the worker wearing a helmet and vest.

## How it works

1. **Write a check.** A short list of rules in plain words:
   - **Yes/no questions**, like "Is the shipping label readable?"
   - **Multiple choice**, like "Is the box sealed, open or damaged?", where you pick which answers are OK.
   - **Find my item**: add one photo of a specific thing, and the app looks for it.
2. **Take a photo**, or point the live camera. One Jev call answers every rule at once, in under a second.
3. **Get the answer.** Each rule gets ✓, ✗ or ? (not sure), and items the app finds are outlined on the photo. The result is **All good**, **Something is wrong**, **Not sure**, or **Photo unclear**.
4. **Review the unsure ones.** Borderline photos wait for a person. Your decisions show how often the app agreed with you, rule by rule.

No sign-up: each browser gets its own private space, and you can link your phone to the same data with a QR code.

Try **“Try a 30-second demo”** on the site. It works with any laptop camera.
