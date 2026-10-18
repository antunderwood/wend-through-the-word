# Wend Through the Word

An explorable graph of the Bible. A reader moves from a verse or an entity to the items linked to it.

## Language

### Graph content

**Verse**:
One verse of the Bible, identified by its Verse Key. A Verse is not an Entity.

**Verse Key**:
The number of a verse in English verse numbering, as book, chapter and verse (Genesis 1:1 is 01001001). The Berean Standard Bible and the KJV share these numbers.
_Avoid_: Verse ID, reference (for the key itself)

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

**Neighbour**:
A node directly linked to another node by a source link or a Co-mention.

### Exploring

**Focus**:
The one node the view is centred on.

**Ring 1**:
The top Neighbours of the Focus, by weight, for each node type.

**Ring 2**:
Up to three of the heaviest Neighbours of each Ring 1 node that pass the current filters, shown faint and unlabelled.

**Overflow Node**:
A single node standing for the remaining Neighbours of one type that did not fit in Ring 1, such as "+42 places". Opening it lists those Neighbours; it never adds them to the scene.
_Avoid_: Group, cluster

**Pinned Node**:
A node the reader keeps on screen while the Focus changes, to compare it with the new Focus. At most three; a Pinned Node brings no Neighbours of its own.
_Avoid_: Bookmark, favourite

**Trail**:
The last five Focus nodes, kept in the scene as small dim nodes joined by a path to the current Focus, and shown as a breadcrumb row.
_Avoid_: Breadcrumb (as a separate concept), history
