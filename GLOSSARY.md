# Wend Through the Word

An explorable graph of the Bible. A reader moves from a verse or an entity to the items linked to it.

## Language

### Graph content

**Verse**:
One verse of the Bible, identified by its Verse Key. A Verse is not an Entity.

**Verse Key**:
The number of a verse in English verse numbering, as book, chapter and verse (Genesis 1:1 is 01001001). The Berean Standard Bible and the KJV share these numbers.
_Avoid_: Verse ID, reference (for the key itself)

**Cross-reference**:
A link from one Verse to a related Verse, from OpenBible.info, such as Gen 1:1 to Ps 115:15.
_Avoid_: Parallel, related verse

**Votes**:
The net number of readers on OpenBible.info who found a Cross-reference helpful (up votes minus down votes). It measures usefulness to readers, not scholarly strength. The Vote Limit hides Cross-references below a chosen number.
_Avoid_: Score, weight, rating

**Dictionary Entry**:
The article on an Entity from Easton's Bible Dictionary (1897), always shown with that name. Not every Entity has one.
_Avoid_: Summary, description

**Entity**:
Any node that is not a Verse: a Person, a Place, an Event, a People Group, or a Theme. Theographic decides what counts as one Person, Place, Event, or People Group.
_Avoid_: Item, thing, object

**People Group**:
A named collective of people, such as the Israelites.
_Avoid_: Group (ambiguous with Overflow Node)

**Theme**:
A topic heading from Nave's Topical Bible (1896) that is not a Person or a Place, such as Faith. A Verse is linked to a Theme because Nave filed it there, not because it names the Theme.
_Avoid_: Topic, tag

**Event Year**:
The approximate year of an Event, as given by Floyd Nolen Jones's chronology. People have no years.
_Avoid_: Date (implies precision), birth year, death year

**Mention**:
A link from a Verse to a Person, Place, Event, or People Group that the Verse names.

**Filed Under**:
A link from a Verse to a Theme, made because Nave placed the Verse under that heading.
_Avoid_: Mention (for Themes), about, tagged

**Co-mention**:
A derived link between two Entities of any type that share at least one Verse, by Mention or Filed Under. Its weight grows with the Verses they share and is scaled down for Entities that appear very often, so that God does not become the top Neighbour of everyone.
_Avoid_: Shared verses, co-occurrence

**Relationship**:
How a Neighbour stands to a node, read from that node: Isaac is Abraham's son, Abraham is Isaac's father. Family words follow the Neighbour's gender. Partners are husband or wife when a verse calls them so, concubine when a verse calls her that (both words when the text uses both), and partner otherwise.

**Possibly Same Person**:
A link between two People whom a tradition reads as one person but the text does not, such as Anah and Beeri. Both stay separate People.
_Avoid_: Alias, merge, duplicate

**Correction Request**:
A reader's suggestion to change a Relationship, an Entity fact, or a verse link, citing at least one Evidence Verse. The owner accepts or declines it.
_Avoid_: Bug report, feedback, edit

**Evidence Verse**:
The verse cited as proof for a curated Relationship, such as Gen 11:29 for Abraham and Sarah.
_Avoid_: Edge (for what the reader sees), connection

**Neighbour**:
A node directly linked to another node by a source link or a Co-mention.

### Exploring

**Focus**:
The one node the view is centred on.

**Selected Node**:
The node shown in the detail panel. Selecting a node never changes the scene; it may be the Focus, any node on screen, or a node on Your Path.
_Avoid_: Active node, current node

**Ring 1**:
The top Neighbours of the Focus, by weight, for each node type.

**Ring 2**:
Up to three of the heaviest Neighbours of each Ring 1 node that pass the current filters, shown faint and unlabelled.

**Overflow Node**:
A single node standing for the remaining Neighbours of one type that did not fit in Ring 1, such as "+42 places". Opening it lists those Neighbours; it never adds them to the scene.
_Avoid_: Group, cluster

**Pinned Node**:
A node the reader keeps on screen while the Focus changes, to compare it with the new Focus. At most three. Each brings its own closest Neighbours, but no Ring 2.

**Shared Node**:
A node in Ring 1 or around a Pinned Node that is linked to both the Focus and a Pinned Node.
_Avoid_: Bookmark, favourite

**Your Path**:
Every node that has been the Focus this session, in order of the latest visit. The last five are drawn in the scene as small dim nodes joined to the current Focus; the breadcrumb row shows all of them.
_Avoid_: Trail (the earlier name), breadcrumb (as a separate concept), history
