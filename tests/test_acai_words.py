import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))  # the tests run the pipeline as a program

from pipeline import acai_words


def test_tokens_match_the_alignment_numbering():
    # The alignment counts each word and each punctuation mark, keeping "God’s" and "Jesse’s" whole.
    assert acai_words.tokens("When Jesus saw the crowds, He went up.") == [
        "When", "Jesus", "saw", "the", "crowds", ",", "He", "went", "up", ".",
    ]  # fmt: skip
    assert acai_words.tokens("God’s son") == ["God’s", "son"]


def test_content_drops_the_function_words_the_alignment_attaches():
    assert acai_words.content(["the", "Israelites"]) == ["Israelites"]
    assert acai_words.content(["to", "for", "of"]) == []
