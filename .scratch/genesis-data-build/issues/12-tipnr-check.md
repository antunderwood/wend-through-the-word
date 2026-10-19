# 12: TIPNR check

**What to build:** the owner can find possible Theographic errors without shipping TIPNR. The build matches TIPNR People to Theographic People by verse overlap, and writes a report of People in the book range where the two disagree on identity or family links. Nothing from TIPNR reaches the export, because TIPNR asks not to be reposted.

The TIPNR fixture is synthetic, written for the test, because the real file must not be reposted.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] A synthetic TIPNR Person that matches a fixture Person by verse overlap but lists a different parent appears in the disagreement report
- [ ] A synthetic TIPNR Person that matches and agrees does not appear
- [ ] No exported file contains any TIPNR value
- [ ] The fixture folder holds no real TIPNR data
