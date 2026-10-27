import { describe, expect, it } from "vitest";
import { boldNames } from "../src/bold";

// The bold words of the runs, in order.
const bold = (text: string, ...nodes: { type: string; name: string; aliases?: string[] }[]) =>
  boldNames(text, nodes).filter((r) => r.bold).map((r) => r.text);
const person = (name: string, ...aliases: string[]) => ({ type: "person", name, aliases });

describe("a shared Verse shows the names of its Person and Place in bold", () => {
  it("bolds the name, and the runs join to the Verse's text", () => {
    const text = "Then Hushai said to Absalom, “The advice is not good.”";
    const runs = boldNames(text, [person("Absalom")]);
    expect(runs).toEqual([
      { text: "Then Hushai said to ", bold: false },
      { text: "Absalom", bold: true, type: "person" },
      { text: ", “The advice is not good.”", bold: false },
    ]);
    expect(runs.map((r) => r.text).join("")).toBe(text);
  });

  it("says whose name a bold run is by type, so the panel can colour it", () => {
    const place = { type: "place", name: "Bethlehem" };
    const runs = boldNames("Jesus was born in Bethlehem.", [{ type: "person", name: "Jesus" }, place]);
    expect(runs.filter((r) => r.bold).map((r) => [r.text, r.type])).toEqual([["Jesus", "person"], ["Bethlehem", "place"]]);
  });

  it("shows a Verse plain when there are no names, and an empty Verse as no runs", () => {
    expect(boldNames("In the beginning God created the heavens and the earth.", [])).toEqual([
      { text: "In the beginning God created the heavens and the earth.", bold: false },
    ]);
    expect(boldNames("", [person("God")])).toEqual([]);
  });

  it("bolds every occurrence, and a possessive with the BSB's apostrophe as the name", () => {
    expect(bold("So Abraham’s servant took ten of his master’s camels, and Abraham went on.", person("Abraham"))).toEqual([
      "Abraham’s",
      "Abraham",
    ]);
    expect(bold("the God of the Hebrews’ fathers, the sons of Moses’", person("Moses"))).toEqual(["Moses’"]);
  });

  it("bolds whole words only, not a name inside a longer word or a hyphenated name", () => {
    expect(bold("Abram went up to Ramah and Ramoth-gilead, arrayed for battle.", person("Ram"))).toEqual([]);
    expect(bold("Hezron was the father of Ram.", person("Ram"))).toEqual(["Ram"]);
    expect(bold("Ben-hadad and Hadad", person("Hadad"))).toEqual(["Hadad"]);
  });

  it("ignores a trailing parenthetical in a name", () => {
    expect(bold("Joseph, the husband of Mary", person("Joseph (Husband of Mary)"))).toEqual(["Joseph"]);
  });

  it("reads a name or an alias with a hyphen or a space at either end as the name without it", () => {
    const text = "from Baale to Baale-judah, and Abram";
    expect(bold(text, { type: "place", name: "Baale-" })).toEqual(["Baale"]);
    expect(bold(text, { type: "place", name: "Gibeah", aliases: ["Baale ", " -"] })).toEqual(["Baale"]);
    expect(bold(text, person("Abraham", "-Abram"))).toEqual(["Abram"]);
  });

  it("bolds a multi-word name as one phrase, a hyphen and a space alike", () => {
    expect(bold("They camped in the Valley of Shaveh.", { type: "place", name: "Valley of Shaveh" })).toEqual(["Valley of Shaveh"]);
    expect(bold("from Baale-judah to Baale Judah", { type: "place", name: "Baale-judah" })).toEqual(["Baale-judah", "Baale Judah"]);
    expect(bold("the hill of Beth Shemesh", { type: "place", name: "Beth-shemesh" })).toEqual(["Beth Shemesh"]);
  });

  it("bolds only a Person or a Place, never an Event, a Theme or a People Group", () => {
    const text = "When Jesus had been baptized, He went up out of the water.";
    expect(bold(text, { type: "event", name: "Jesus" }, { type: "theme", name: "Jesus" }, { type: "group", name: "Jesus" })).toEqual([]);
  });

  it("bolds a name's aliases, the longest first", () => {
    const text = "So Abram moved his tent; Simon Peter and Simon";
    expect(bold(text, person("Peter", "Simon Peter", "Simon"), person("Abraham", "Abram"))).toEqual(["Abram", "Simon Peter", "Simon"]);
  });

  it("bolds a word of a Person's name alone, unless the name is a description with “of”", () => {
    expect(bold("Then Pilate asked Him, “Do You not hear?”", person("Pontius Pilate"))).toEqual(["Pilate"]);
    expect(bold("After Jesus was born in Bethlehem", person("Jesus Christ"))).toEqual(["Jesus"]);
    expect(bold("Soon the daughter of Pharaoh went down to bathe in the Nile", person("Daughter of Pharaoh"))).toEqual([]);
  });
});

describe("an ordinary word is never bold", () => {
  const god = person("God", "LORD", "Lord", "Father", "hosts", "Almighty", "Holy", "GOD", "last", "Judge");
  const jesus = person("Jesus Christ", "Lord", "King", "Holy", "Master");

  it("never bolds God's aliases “last” and “Holy”", () => {
    expect(bold("I am the First and the last, says the LORD.", god)).toEqual(["LORD"]);
    expect(bold("“Holy, holy, holy is the LORD of Hosts; all the earth is full of His glory.”", god)).toEqual(["LORD"]);
    expect(bold("For I am the LORD your God, the Holy One of Israel, your Savior;", god)).toEqual(["LORD", "God"]);
    expect(bold("they never stop saying: “Holy, Holy, Holy, is the Lord God Almighty, who was and is and is to come!”", god)).toEqual([
      "Lord",
      "God",
      "Almighty",
    ]);
    expect(bold("whose name is Holy: “I dwell in a high and holy place,", god)).toEqual([]);
    expect(bold("You rejected the Holy and Righteous One", jesus)).toEqual([]);
  });

  it("bolds a name that is also an ordinary word only where it is written as a name", () => {
    expect(bold("Job continued his discourse:", person("Job"))).toEqual(["Job"]);
    expect(bold("Barnabas wanted to take John, also called Mark.", person("Mark"))).toEqual(["Mark"]);
    expect(bold("to receive a mark on their right hand or on their forehead,", person("Mark"))).toEqual([]);
  });

  it("does not bold an alias at a sentence's or a quotation's start", () => {
    const text = "But Peter and John replied, “Judge for yourselves whether it is right in God’s sight to listen to you rather than God.";
    expect(bold(text, god)).toEqual(["God’s", "God"]);
    expect(bold("The second servant came and said, ‘Master, your mina has made five minas.’", jesus)).toEqual([]);
    expect(bold("Holy Father, protect them by Your name,", god)).toEqual(["Father"]);
  });

  it("does not bold a call at a quotation's start, as the text does not tell it from a parable's", () => {
    // Matt 8:25, where Theographic tags Jesus (owner, decision 207).
    expect(bold("The disciples went and woke Him, saying, “Lord, save us! We are perishing!”", jesus)).toEqual([]);
  });

  it("bolds an alias next to a capitalised word across a comma, which parts a list, not a title", () => {
    const abraham = person("Abraham", "Abram");
    expect(bold("Terah took his son Abram, Lot his grandson,", abraham)).toEqual(["Abram"]);
    expect(bold("After leaving Haran, Abram took his wife Sarai", abraham)).toEqual(["Abram"]);
    expect(bold("After leaving Haran and Abram took his wife Sarai", abraham)).toEqual([]);
  });

  it("does not bold an alias that is part of some other name", () => {
    expect(bold("After Jesus was born in Bethlehem in Judea, during the time of King Herod,", jesus)).toEqual(["Jesus"]);
    expect(bold("“the Lord Jesus, who appeared to you on the road", jesus)).toEqual(["Lord", "Jesus"]);
    expect(bold("I will also deny him before My Father in heaven.", god)).toEqual(["Father"]);
  });

  it("guards each node's names on their own: another node's name does not make an alias a name", () => {
    // Matt 2:1 with the panel's two nodes: "King" is Jesus's alias, but here Herod's title.
    const text = "After Jesus was born in Bethlehem in Judea, during the time of King Herod, Magi from the east arrived in Jerusalem,";
    expect(bold(text, jesus, person("Herod"))).toEqual(["Jesus", "Herod"]);
    expect(bold(text, person("Herod"), jesus)).toEqual(["Jesus", "Herod"]);
  });

  it("counts another node's name as a name where “and” joins the two, as in a list of people", () => {
    // Acts 3:1, Luke 23:12 and Acts 11:30, each with the two nodes Theographic tags.
    const peter = person("Simon Peter", "Peter", "Simon", "Cephas");
    const john = person("John the Apostle");
    const peterAndJohn = "One afternoon Peter and John were going up to the temple at the hour of prayer, the ninth hour.";
    expect(bold(peterAndJohn, peter, john)).toEqual(["Peter", "John"]);
    // Each node alone still keeps its word plain beside a name it does not know.
    expect(bold(peterAndJohn, peter)).toEqual([]);
    expect(bold("That day Herod and Pilate became friends; before this time they had been enemies.", person("Herod Antipas"), person("Pontius Pilate"))).toEqual([
      "Herod",
      "Pilate",
    ]);
    expect(bold("This they did, sending their gift to the elders with Barnabas and Saul.", person("Barnabas"), person("Paul", "Saul"))).toEqual([
      "Barnabas",
      "Saul",
    ]);
  });

  it("still keeps a word plain where “and” joins it to a capitalised word that is no node's name", () => {
    expect(bold("You rejected the Holy and Righteous One", jesus, god)).toEqual([]);
    expect(bold("Then Peter and Andrew left their nets", person("Simon Peter", "Peter"), person("John the Apostle"))).toEqual([]);
  });
});
