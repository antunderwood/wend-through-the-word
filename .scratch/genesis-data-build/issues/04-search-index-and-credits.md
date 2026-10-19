# 04: Search index and credits

**What to build:** the front end can search names in the browser and show a credits page with no hand editing. The search index lists the name, aliases, type, and ID of every Entity, plus the book and chapter list. It is also the label lookup for Ring 2 IDs. The credits file lists every source with its licence and link.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] A search for "Abraham" in the index returns `person:abraham_58` (on the slow full-Genesis run; the fixture test uses a fixture Person)
- [ ] Aliases from Theographic are in the index
- [ ] Entities added by later tickets (for example Themes) appear without a change to this code
- [ ] The search index is below 500 KB compressed, and a test checks it
- [ ] The credits file lists every source the build read, with its licence and link, and no source the build did not read
- [ ] No TIPNR entry appears in the credits as shipped data
- [ ] The credits say the data is modified, link to the curated tables, and link to Theographic's source bibliography (decision 45)
