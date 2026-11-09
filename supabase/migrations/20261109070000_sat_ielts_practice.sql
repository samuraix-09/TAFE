-- Original TAFE practice content. SAT modules are fixed, not adaptive.
-- Stable test IDs keep reruns from overwriting edits made by administrators.
do $seed$
declare
  pack jsonb;
  test_id uuid;
  question_id uuid;
  item record;
begin
  for pack in select value from jsonb_array_elements($practice$
[
  {
    "id": "e4b994df-8f8f-582a-bba2-e53c002d825a",
    "slug": "sat",
    "section": "Reading and Writing",
    "title": "SAT Reading and Writing · Module 1",
    "duration": 32,
    "questions": [
      {
        "prompt": "The bridge remained operational throughout the storm. In this sentence, what does “operational” most nearly mean?",
        "options": [
          "functional",
          "fragile",
          "temporary",
          "hidden"
        ],
        "answer": "functional",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "A second survey corroborated the team’s initial findings. In this sentence, what does “corroborated” most nearly mean?",
        "options": [
          "replaced",
          "distorted",
          "ignored",
          "confirmed"
        ],
        "answer": "confirmed",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The once abundant plant is now scarce. In this sentence, what does “scarce” most nearly mean?",
        "options": [
          "widespread",
          "cultivated",
          "rare",
          "hardy"
        ],
        "answer": "rare",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The new insulation mitigated the effects of cold weather. In this sentence, what does “mitigated” most nearly mean?",
        "options": [
          "reversed",
          "reduced",
          "measured",
          "predicted"
        ],
        "answer": "reduced",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The architect retained the original façade. In this sentence, what does “retained” most nearly mean?",
        "options": [
          "kept",
          "photographed",
          "removed",
          "redesigned"
        ],
        "answer": "kept",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The editor requested a concise account of the event. In this sentence, what does “concise” most nearly mean?",
        "options": [
          "dramatic",
          "incomplete",
          "speculative",
          "brief"
        ],
        "answer": "brief",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The results were preliminary and could change with further analysis. In this sentence, what does “preliminary” most nearly mean?",
        "options": [
          "final",
          "unrelated",
          "initial",
          "unreliable"
        ],
        "answer": "initial",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The council allocated funds to the library. In this sentence, what does “allocated” most nearly mean?",
        "options": [
          "recovered",
          "assigned",
          "borrowed",
          "withheld"
        ],
        "answer": "assigned",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The material is resilient and returns to its shape after bending. In this sentence, what does “resilient” most nearly mean?",
        "options": [
          "able to recover",
          "easily broken",
          "difficult to find",
          "slow to change"
        ],
        "answer": "able to recover",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "Neither of the proposals ___ the cost of maintenance. Which choice completes the sentence?",
        "options": [
          "address",
          "have addressed",
          "are addressing",
          "addresses"
        ],
        "answer": "addresses",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "By the time the survey began, the team ___ its instruments. Which choice completes the sentence?",
        "options": [
          "will calibrate",
          "is calibrating",
          "had calibrated",
          "calibrates"
        ],
        "answer": "had calibrated",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The paintings in the west gallery ___ to the nineteenth century. Which choice completes the sentence?",
        "options": [
          "is dating",
          "date",
          "dates",
          "has dated"
        ],
        "answer": "date",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "A series of workshops ___ scheduled for the spring. Which choice completes the sentence?",
        "options": [
          "is",
          "are",
          "have been",
          "were"
        ],
        "answer": "is",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "If the team had started earlier, it ___ the survey before sunset. Which choice completes the sentence?",
        "options": [
          "will complete",
          "would complete",
          "has completed",
          "would have completed"
        ],
        "answer": "would have completed",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The volunteers cleaned the beach, ___ recyclable materials in separate bins. Which choice completes the sentence?",
        "options": [
          "placed",
          "to placing",
          "placing",
          "places"
        ],
        "answer": "placing",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The data in the appendix ___ the conclusions of the report. Which choice completes the sentence?",
        "options": [
          "has supported",
          "support",
          "supports",
          "is supporting"
        ],
        "answer": "support",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "Each of the samples ___ labeled before storage. Which choice completes the sentence?",
        "options": [
          "was",
          "were",
          "have been",
          "are"
        ],
        "answer": "was",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The scientist to ___ the prize was awarded thanked her colleagues. Which choice completes the sentence?",
        "options": [
          "who",
          "whose",
          "which",
          "whom"
        ],
        "answer": "whom",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "After adding shaded benches, a park saw more visitors between noon and two. Morning visits remained unchanged.\n\nWhat change did the report directly observe?",
        "options": [
          "An increase in ticket prices.",
          "A decline in overall use.",
          "An increase in midday visits.",
          "A decrease in morning visits."
        ],
        "answer": "An increase in midday visits.",
        "evidence": "After adding shaded benches, a park saw more visitors between noon and two. Morning visits remained unchanged.",
        "type": "multiple_choice"
      },
      {
        "prompt": "Two groups read the same article. The group that wrote summaries remembered more details the following week.\n\nWhich conclusion is best supported?",
        "options": [
          "Writing summaries always improves memory.",
          "Writing summaries was associated with better recall.",
          "The groups read different articles.",
          "Both groups forgot the same details."
        ],
        "answer": "Writing summaries was associated with better recall.",
        "evidence": "Two groups read the same article. The group that wrote summaries remembered more details the following week.",
        "type": "multiple_choice"
      },
      {
        "prompt": "Most of the seeds germinated at 20°C, but few germinated at 5°C. The other conditions were identical.\n\nWhich factor differed between the groups?",
        "options": [
          "Temperature.",
          "Water quality.",
          "Soil depth.",
          "Light exposure."
        ],
        "answer": "Temperature.",
        "evidence": "Most of the seeds germinated at 20°C, but few germinated at 5°C. The other conditions were identical.",
        "type": "multiple_choice"
      },
      {
        "prompt": "Although electric buses cost more initially, the district expects lower maintenance bills over the next decade.\n\nWhat contrast does the text make?",
        "options": [
          "Higher fuel costs versus higher fares.",
          "Lower purchase costs versus increased maintenance.",
          "Shorter routes versus longer travel times.",
          "Higher purchase costs versus lower expected maintenance costs."
        ],
        "answer": "Higher purchase costs versus lower expected maintenance costs.",
        "evidence": "Although electric buses cost more initially, the district expects lower maintenance bills over the next decade.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The study included only plants grown indoors. The researchers caution that wind and pests could change the results outdoors.\n\nWhy do the researchers urge caution?",
        "options": [
          "All plants failed to grow.",
          "Wind was the primary variable tested.",
          "Outdoor conditions were outside the study.",
          "The indoor plants were exposed to pests."
        ],
        "answer": "Outdoor conditions were outside the study.",
        "evidence": "The study included only plants grown indoors. The researchers caution that wind and pests could change the results outdoors.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A museum moved its free evening from Tuesday to Friday. In the next month, evening attendance rose, but visitor surveys were not collected.\n\nWhat remains unknown?",
        "options": [
          "Whether the museum offered evening entry.",
          "Why attendance increased.",
          "Whether attendance changed.",
          "Which day now has free entry."
        ],
        "answer": "Why attendance increased.",
        "evidence": "A museum moved its free evening from Tuesday to Friday. In the next month, evening attendance rose, but visitor surveys were not collected.",
        "type": "multiple_choice"
      },
      {
        "prompt": "One explanation for the bird’s decline is that a common insect became harder to find. A second explanation is that suitable nesting sites disappeared.\n\nWhat is the main purpose of the text?",
        "options": [
          "To present two explanations for a decline.",
          "To demonstrate that one explanation is false.",
          "To list the bird’s nesting habits.",
          "To explain how the insect reproduces."
        ],
        "answer": "To present two explanations for a decline.",
        "evidence": "One explanation for the bird’s decline is that a common insect became harder to find. A second explanation is that suitable nesting sites disappeared.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The new material conducted heat well but cracked after repeated bending. The team recommended it for rigid components.\n\nWhy did the team recommend rigid components?",
        "options": [
          "Rigid components must insulate heat.",
          "The material became more flexible with use.",
          "The team did not test heat conduction.",
          "Repeated bending damaged the material."
        ],
        "answer": "Repeated bending damaged the material.",
        "evidence": "The new material conducted heat well but cracked after repeated bending. The team recommended it for rigid components.",
        "type": "multiple_choice"
      },
      {
        "prompt": "Records indicate the building opened in 1890. A photograph dated 1888 shows workers assembling its roof.\n\nWhat does the photograph establish?",
        "options": [
          "Roof construction began after the opening.",
          "The building was demolished in 1888.",
          "Construction was underway before the opening.",
          "The building opened two years earlier than reported."
        ],
        "answer": "Construction was underway before the opening.",
        "evidence": "Records indicate the building opened in 1890. A photograph dated 1888 shows workers assembling its roof.",
        "type": "multiple_choice"
      }
    ],
    "passage": ""
  },
  {
    "id": "9c4d7708-f642-5cca-9458-57c66aa2f1b7",
    "slug": "sat",
    "section": "Reading and Writing",
    "title": "SAT Reading and Writing · Module 2",
    "duration": 32,
    "questions": [
      {
        "prompt": "The report distinguishes observed effects from predictions. In this sentence, what does “distinguishes” most nearly mean?",
        "options": [
          "separates",
          "combines",
          "calculates",
          "questions"
        ],
        "answer": "separates",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The island’s steep slopes constrain where houses can be built. In this sentence, what does “constrain” most nearly mean?",
        "options": [
          "identify",
          "expand",
          "conceal",
          "limit"
        ],
        "answer": "limit",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The document offers a plausible account of the unexplained delay. In this sentence, what does “plausible” most nearly mean?",
        "options": [
          "contradictory",
          "complete",
          "believable",
          "official"
        ],
        "answer": "believable",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The researchers devised a new method of measuring rainfall. In this sentence, what does “devised” most nearly mean?",
        "options": [
          "criticized",
          "designed",
          "abandoned",
          "copied"
        ],
        "answer": "designed",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "A sudden increase in demand accelerated production. In this sentence, what does “accelerated” most nearly mean?",
        "options": [
          "sped up",
          "stopped",
          "reduced",
          "financed"
        ],
        "answer": "sped up",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The museum acquired several paintings from a private collector. In this sentence, what does “acquired” most nearly mean?",
        "options": [
          "displayed",
          "restored",
          "returned",
          "obtained"
        ],
        "answer": "obtained",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The survey revealed a consistent pattern across the three towns. In this sentence, what does “consistent” most nearly mean?",
        "options": [
          "temporary",
          "complex",
          "uniform",
          "accidental"
        ],
        "answer": "uniform",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The narrative omits details that are unrelated to the main event. In this sentence, what does “omits” most nearly mean?",
        "options": [
          "repeats",
          "leaves out",
          "adds",
          "confirms"
        ],
        "answer": "leaves out",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The researchers used an indirect measure of water loss. In this sentence, what does “indirect” most nearly mean?",
        "options": [
          "based on a proxy",
          "completely untested",
          "measured by sight",
          "based on a prediction"
        ],
        "answer": "based on a proxy",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The archive contains maps ___ show how the river shifted. Which choice completes the sentence?",
        "options": [
          "whose",
          "whom",
          "where",
          "that"
        ],
        "answer": "that",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "She had reviewed the entire draft before she ___ her comments. Which choice completes the sentence?",
        "options": [
          "has submitted",
          "will submit",
          "submitted",
          "submits"
        ],
        "answer": "submitted",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The students were given two choices: ___ the existing design or propose a new one. Which choice completes the sentence?",
        "options": [
          "had revised",
          "revise",
          "revised",
          "revising"
        ],
        "answer": "revise",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The team tested the battery twice; ___, it remained unsure of the result. Which choice completes the sentence?",
        "options": [
          "however",
          "therefore",
          "for example",
          "similarly"
        ],
        "answer": "however",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "Demand fell sharply. ___, the factory reduced production. Which choice completes the sentence?",
        "options": [
          "Nevertheless",
          "For instance",
          "In contrast",
          "Consequently"
        ],
        "answer": "Consequently",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The author cites two examples of urban adaptation. ___, some plants flower earlier in warmer city centers. Which choice completes the sentence?",
        "options": [
          "Instead",
          "Conversely",
          "For instance",
          "Nevertheless"
        ],
        "answer": "For instance",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The river was usually shallow. ___, after days of heavy rain, it overflowed. Which choice completes the sentence?",
        "options": [
          "In other words",
          "However",
          "Similarly",
          "For this reason"
        ],
        "answer": "However",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "The first survey measured travel time. ___, the second measured fuel use rather than time. Which choice completes the sentence?",
        "options": [
          "By contrast",
          "Consequently",
          "For example",
          "Indeed"
        ],
        "answer": "By contrast",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "Three species returned after the wetland was restored. ___, the area now supports more species than before. Which choice completes the sentence?",
        "options": [
          "Nevertheless",
          "By contrast",
          "For instance",
          "As a result"
        ],
        "answer": "As a result",
        "evidence": "",
        "type": "multiple_choice"
      },
      {
        "prompt": "A filter removed most large particles but allowed smaller particles to pass. A second filter caught most of those smaller particles.\n\nHow did the second filter improve the system?",
        "options": [
          "It reduced the number of large particles entering the system.",
          "It replaced the need for filtration.",
          "It captured particles the first filter missed.",
          "It released particles from the first filter."
        ],
        "answer": "It captured particles the first filter missed.",
        "evidence": "A filter removed most large particles but allowed smaller particles to pass. A second filter caught most of those smaller particles.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A city reduced its bus fares while increasing the frequency of service. Ridership increased over the next quarter.\n\nWhy can the increase not be attributed to fares alone?",
        "options": [
          "The fare change preceded the service change by years.",
          "Service frequency changed at the same time.",
          "The city increased its fares.",
          "Ridership was not measured."
        ],
        "answer": "Service frequency changed at the same time.",
        "evidence": "A city reduced its bus fares while increasing the frequency of service. Ridership increased over the next quarter.",
        "type": "multiple_choice"
      },
      {
        "prompt": "Some artists in the exhibition use discarded materials to reduce waste. Others choose those materials because their irregular shapes invite experimentation.\n\nWhat does the text emphasize?",
        "options": [
          "Artists can choose the same materials for different reasons.",
          "All artists in the exhibition share the same goal.",
          "Discarded materials limit experimentation.",
          "Only irregular materials reduce waste."
        ],
        "answer": "Artists can choose the same materials for different reasons.",
        "evidence": "Some artists in the exhibition use discarded materials to reduce waste. Others choose those materials because their irregular shapes invite experimentation.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The first night’s measurements were discarded because the instrument had been exposed to rain. Later measurements were taken under a protective cover.\n\nWhy were the first measurements discarded?",
        "options": [
          "The protective cover changed the weather.",
          "The later measurements were unavailable.",
          "The experiment required a sunny location.",
          "Rain may have affected the instrument."
        ],
        "answer": "Rain may have affected the instrument.",
        "evidence": "The first night’s measurements were discarded because the instrument had been exposed to rain. Later measurements were taken under a protective cover.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A local newspaper published a weekly column about transit improvements. Its writers focused on proposals that had been funded and excluded proposals still under debate.\n\nWhich proposal would most likely appear in the column?",
        "options": [
          "A bus route under discussion with no budget.",
          "A petition asking the city to consider a bridge.",
          "A funded upgrade to a tram stop.",
          "An unfunded idea for a new railway."
        ],
        "answer": "A funded upgrade to a tram stop.",
        "evidence": "A local newspaper published a weekly column about transit improvements. Its writers focused on proposals that had been funded and excluded proposals still under debate.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The village installed meters on all public taps. Officials later found that most of the water loss came from a single damaged pipe.\n\nWhat did officials find?",
        "options": [
          "Water loss was unrelated to the pipe network.",
          "One damaged pipe accounted for most of the loss.",
          "Public taps had not been fitted with meters.",
          "Most of the loss came from many small leaks."
        ],
        "answer": "One damaged pipe accounted for most of the loss.",
        "evidence": "The village installed meters on all public taps. Officials later found that most of the water loss came from a single damaged pipe.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The author describes the machine first as surprisingly simple and later as difficult to repair without specialized tools.\n\nWhat distinction does the author make?",
        "options": [
          "Simple design does not guarantee easy repair.",
          "Complex design always makes repair impossible.",
          "Specialized tools simplify the original design.",
          "The machine was repaired easily by the author."
        ],
        "answer": "Simple design does not guarantee easy repair.",
        "evidence": "The author describes the machine first as surprisingly simple and later as difficult to repair without specialized tools.",
        "type": "multiple_choice"
      },
      {
        "prompt": "In a field trial, a reflective coating lowered roof temperatures during sunny afternoons. The study recorded no readings after dark.\n\nWhat question cannot be answered from the trial?",
        "options": [
          "Whether the trial took place outdoors.",
          "When the recorded cooling occurred.",
          "Whether the coating was reflective.",
          "How the coating affects roof temperatures at night."
        ],
        "answer": "How the coating affects roof temperatures at night.",
        "evidence": "In a field trial, a reflective coating lowered roof temperatures during sunny afternoons. The study recorded no readings after dark.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A tree inventory revealed that just two species accounted for most trees on a single street. The city plans to plant more species there.\n\nWhat goal does the plan most directly serve?",
        "options": [
          "Measuring the age of the existing trees.",
          "Removing every tree from the street.",
          "Increasing the diversity of street trees.",
          "Reducing the number of species on the street."
        ],
        "answer": "Increasing the diversity of street trees.",
        "evidence": "A tree inventory revealed that just two species accounted for most trees on a single street. The city plans to plant more species there.",
        "type": "multiple_choice"
      }
    ],
    "passage": ""
  },
  {
    "id": "e74e5cb0-f8b8-5c37-bf33-7026c247b906",
    "slug": "sat",
    "section": "Math",
    "title": "SAT Math · Module 1",
    "duration": 35,
    "questions": [
      {
        "prompt": "If 3x + 3 = 21, what is x?",
        "options": [
          "6",
          "4",
          "8",
          "10"
        ],
        "answer": "6",
        "evidence": "3x = 18.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A price of $40 is reduced by 20%. What is the new price in dollars?",
        "options": [
          "30",
          "34",
          "36",
          "32"
        ],
        "answer": "32",
        "evidence": "Multiply the original price by 0.8.",
        "type": "multiple_choice"
      },
      {
        "prompt": "What is the positive solution of x² = 25?",
        "options": [],
        "answer": [
          "5"
        ],
        "evidence": "Take the positive square root.",
        "type": "numeric_answer"
      },
      {
        "prompt": "A line passes through (1, 6) and (5, 18). What is its slope?",
        "options": [
          "7",
          "3",
          "1",
          "5"
        ],
        "answer": "3",
        "evidence": "The rise is 12 and the run is 4.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A rectangle has width 7 and length 11. What is its area?",
        "options": [
          "77",
          "75",
          "79",
          "81"
        ],
        "answer": "77",
        "evidence": "Multiply length by width.",
        "type": "multiple_choice"
      },
      {
        "prompt": "What is the arithmetic mean of 8, 12, 16, and 20?",
        "options": [
          "12",
          "16",
          "18",
          "14"
        ],
        "answer": "14",
        "evidence": "The sum divided by four is the mean.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A bag contains 9 red and 27 blue marbles. If one marble is selected at random, what percent chance is it red?",
        "options": [
          "27",
          "29",
          "25",
          "23"
        ],
        "answer": "25",
        "evidence": "One quarter of the marbles are red.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The function f(x) = 2x² − 10. What is f(3)?",
        "options": [],
        "answer": [
          "8"
        ],
        "evidence": "Substitute 3 for x to get 18 minus the constant.",
        "type": "numeric_answer"
      },
      {
        "prompt": "The number of cells starts at 11 and triples every hour. How many are there after 3 hours?",
        "options": [
          "297",
          "295",
          "299",
          "301"
        ],
        "answer": "297",
        "evidence": "Multiply the starting count by 3³.",
        "type": "multiple_choice"
      },
      {
        "prompt": "In a right triangle, the legs are 36 and 48. What is the hypotenuse?",
        "options": [
          "58",
          "62",
          "64",
          "60"
        ],
        "answer": "60",
        "evidence": "The legs have a 3:4 ratio, giving a 3:4:5 triangle.",
        "type": "multiple_choice"
      },
      {
        "prompt": "If 2x + y = 65 and x − y = 13, what is x?",
        "options": [
          "28",
          "30",
          "26",
          "24"
        ],
        "answer": "26",
        "evidence": "Adding the equations gives 3x = six times the common factor.",
        "type": "multiple_choice"
      },
      {
        "prompt": "If 3x + 14 = 98, what is x?",
        "options": [
          "32",
          "28",
          "26",
          "30"
        ],
        "answer": "28",
        "evidence": "3x = 84.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A price of $150 is reduced by 20%. What is the new price in dollars?",
        "options": [],
        "answer": [
          "120"
        ],
        "evidence": "Multiply the original price by 0.8.",
        "type": "numeric_answer"
      },
      {
        "prompt": "What is the positive solution of x² = 256?",
        "options": [
          "14",
          "18",
          "20",
          "16"
        ],
        "answer": "16",
        "evidence": "Take the positive square root.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A line passes through (1, 17) and (5, 29). What is its slope?",
        "options": [
          "5",
          "7",
          "3",
          "1"
        ],
        "answer": "3",
        "evidence": "The rise is 12 and the run is 4.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A rectangle has width 18 and length 22. What is its area?",
        "options": [
          "400",
          "396",
          "394",
          "398"
        ],
        "answer": "396",
        "evidence": "Multiply length by width.",
        "type": "multiple_choice"
      },
      {
        "prompt": "What is the arithmetic mean of 19, 23, 27, and 31?",
        "options": [
          "25",
          "23",
          "27",
          "29"
        ],
        "answer": "25",
        "evidence": "The sum divided by four is the mean.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A bag contains 20 red and 60 blue marbles. If one marble is selected at random, what percent chance is it red?",
        "options": [],
        "answer": [
          "25"
        ],
        "evidence": "One quarter of the marbles are red.",
        "type": "numeric_answer"
      },
      {
        "prompt": "The function f(x) = 2x² − 21. What is f(3)?",
        "options": [
          "-1",
          "1",
          "-3",
          "-5"
        ],
        "answer": "-3",
        "evidence": "Substitute 3 for x to get 18 minus the constant.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The number of cells starts at 22 and triples every hour. How many are there after 3 hours?",
        "options": [
          "598",
          "594",
          "592",
          "596"
        ],
        "answer": "594",
        "evidence": "Multiply the starting count by 3³.",
        "type": "multiple_choice"
      },
      {
        "prompt": "In a right triangle, the legs are 69 and 92. What is the hypotenuse?",
        "options": [
          "115",
          "113",
          "117",
          "119"
        ],
        "answer": "115",
        "evidence": "The legs have a 3:4 ratio, giving a 3:4:5 triangle.",
        "type": "multiple_choice"
      },
      {
        "prompt": "If 2x + y = 120 and x − y = 24, what is x?",
        "options": [],
        "answer": [
          "48"
        ],
        "evidence": "Adding the equations gives 3x = six times the common factor.",
        "type": "numeric_answer"
      }
    ],
    "passage": ""
  },
  {
    "id": "2b07157d-ac83-5713-9ee9-ea7e0329dc2d",
    "slug": "sat",
    "section": "Math",
    "title": "SAT Math · Module 2",
    "duration": 35,
    "questions": [
      {
        "prompt": "If 3x + 8 = 56, what is x?",
        "options": [
          "16",
          "14",
          "18",
          "20"
        ],
        "answer": "16",
        "evidence": "3x = 48.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A price of $90 is reduced by 20%. What is the new price in dollars?",
        "options": [
          "70",
          "74",
          "76",
          "72"
        ],
        "answer": "72",
        "evidence": "Multiply the original price by 0.8.",
        "type": "multiple_choice"
      },
      {
        "prompt": "What is the positive solution of x² = 100?",
        "options": [],
        "answer": [
          "10"
        ],
        "evidence": "Take the positive square root.",
        "type": "numeric_answer"
      },
      {
        "prompt": "A line passes through (1, 11) and (5, 23). What is its slope?",
        "options": [
          "7",
          "3",
          "1",
          "5"
        ],
        "answer": "3",
        "evidence": "The rise is 12 and the run is 4.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A rectangle has width 12 and length 16. What is its area?",
        "options": [
          "192",
          "190",
          "194",
          "196"
        ],
        "answer": "192",
        "evidence": "Multiply length by width.",
        "type": "multiple_choice"
      },
      {
        "prompt": "What is the arithmetic mean of 13, 17, 21, and 25?",
        "options": [
          "17",
          "21",
          "23",
          "19"
        ],
        "answer": "19",
        "evidence": "The sum divided by four is the mean.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A bag contains 14 red and 42 blue marbles. If one marble is selected at random, what percent chance is it red?",
        "options": [
          "27",
          "29",
          "25",
          "23"
        ],
        "answer": "25",
        "evidence": "One quarter of the marbles are red.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The function f(x) = 2x² − 15. What is f(3)?",
        "options": [],
        "answer": [
          "3"
        ],
        "evidence": "Substitute 3 for x to get 18 minus the constant.",
        "type": "numeric_answer"
      },
      {
        "prompt": "The number of cells starts at 16 and triples every hour. How many are there after 3 hours?",
        "options": [
          "432",
          "430",
          "434",
          "436"
        ],
        "answer": "432",
        "evidence": "Multiply the starting count by 3³.",
        "type": "multiple_choice"
      },
      {
        "prompt": "In a right triangle, the legs are 51 and 68. What is the hypotenuse?",
        "options": [
          "83",
          "87",
          "89",
          "85"
        ],
        "answer": "85",
        "evidence": "The legs have a 3:4 ratio, giving a 3:4:5 triangle.",
        "type": "multiple_choice"
      },
      {
        "prompt": "If 2x + y = 90 and x − y = 18, what is x?",
        "options": [
          "38",
          "40",
          "36",
          "34"
        ],
        "answer": "36",
        "evidence": "Adding the equations gives 3x = six times the common factor.",
        "type": "multiple_choice"
      },
      {
        "prompt": "If 3x + 19 = 133, what is x?",
        "options": [
          "42",
          "38",
          "36",
          "40"
        ],
        "answer": "38",
        "evidence": "3x = 114.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A price of $200 is reduced by 20%. What is the new price in dollars?",
        "options": [],
        "answer": [
          "160"
        ],
        "evidence": "Multiply the original price by 0.8.",
        "type": "numeric_answer"
      },
      {
        "prompt": "What is the positive solution of x² = 441?",
        "options": [
          "19",
          "23",
          "25",
          "21"
        ],
        "answer": "21",
        "evidence": "Take the positive square root.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A line passes through (1, 22) and (5, 34). What is its slope?",
        "options": [
          "5",
          "7",
          "3",
          "1"
        ],
        "answer": "3",
        "evidence": "The rise is 12 and the run is 4.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A rectangle has width 23 and length 27. What is its area?",
        "options": [
          "625",
          "621",
          "619",
          "623"
        ],
        "answer": "621",
        "evidence": "Multiply length by width.",
        "type": "multiple_choice"
      },
      {
        "prompt": "What is the arithmetic mean of 24, 28, 32, and 36?",
        "options": [
          "30",
          "28",
          "32",
          "34"
        ],
        "answer": "30",
        "evidence": "The sum divided by four is the mean.",
        "type": "multiple_choice"
      },
      {
        "prompt": "A bag contains 25 red and 75 blue marbles. If one marble is selected at random, what percent chance is it red?",
        "options": [],
        "answer": [
          "25"
        ],
        "evidence": "One quarter of the marbles are red.",
        "type": "numeric_answer"
      },
      {
        "prompt": "The function f(x) = 2x² − 26. What is f(3)?",
        "options": [
          "-6",
          "-4",
          "-8",
          "-10"
        ],
        "answer": "-8",
        "evidence": "Substitute 3 for x to get 18 minus the constant.",
        "type": "multiple_choice"
      },
      {
        "prompt": "The number of cells starts at 27 and triples every hour. How many are there after 3 hours?",
        "options": [
          "733",
          "729",
          "727",
          "731"
        ],
        "answer": "729",
        "evidence": "Multiply the starting count by 3³.",
        "type": "multiple_choice"
      },
      {
        "prompt": "In a right triangle, the legs are 84 and 112. What is the hypotenuse?",
        "options": [
          "140",
          "138",
          "142",
          "144"
        ],
        "answer": "140",
        "evidence": "The legs have a 3:4 ratio, giving a 3:4:5 triangle.",
        "type": "multiple_choice"
      },
      {
        "prompt": "If 2x + y = 145 and x − y = 29, what is x?",
        "options": [],
        "answer": [
          "58"
        ],
        "evidence": "Adding the equations gives 3x = six times the common factor.",
        "type": "numeric_answer"
      }
    ],
    "passage": ""
  },
  {
    "id": "70767467-ea94-5677-9212-77a335806796",
    "slug": "ielts",
    "section": "Academic Reading",
    "title": "IELTS Academic Reading · Practice Set 1",
    "duration": 60,
    "questions": [
      {
        "prompt": "Passage A · The study started in 2019.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The planners began in 2019.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · All streets in the study had the same amount of tree cover.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "The streets had different amounts of tree cover.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The temperature sensors were purchased from a local manufacturer.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "The sensor manufacturer is unspecified.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · Air and road-surface temperatures were measured separately.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "A separate instrument measured road surfaces.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The cooling pattern was more consistent at night than on clear afternoons.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "At night the pattern was less consistent.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The greatest temperature difference occurred just after two in the afternoon.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The largest difference appeared shortly after two.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The team proved that coastal cities would show the same pattern.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "The researchers warned that the coastal pattern was unknown.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · Some people found light reflected from the coated car park uncomfortable.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Some pedestrians complained about reflected sunlight.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The coating was more expensive than planting new trees.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "The passage does not compare costs.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The council planned to consider glare near crossings.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "It decided to monitor glare before applying coatings near crossings.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The report advised planting only one tree species.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "It recommended a variety of species.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · Newly planted trees needed regular watering in their first summers.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The last sentence states this watering requirement.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage A · The study measured changes in local electricity bills.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "Electricity bills are not reported.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The seeds were initially used mostly as historical records.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The collection served mainly as a historical record.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The handwritten labels were digitized after all packets were opened.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "Labels were digitized before opening.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · Every packet in the archive was tested.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "Only selected packets were tested.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The team kept some material untouched.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Selection required enough seeds to retain untouched material.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The cool treatment lasted exactly seven days.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "The treatment duration is not specified.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · All tested species benefited from cooling.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "Some showed little difference.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · Some barley seeds grew into seedlings.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "A small number produced seedlings.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The isolated greenhouse reduced the risk of crossing with modern varieties.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Isolation was intended to prevent accidental crossing.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The first report compared the yield of old and modern barley.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "It reported only germination results.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · The project received funding from a farming association.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "Funding sources are unspecified.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · New accessions were split between two locations.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The archive divided each new accession.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · Rare material requests required an extra review.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The guide specifies additional review for rare samples.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage B · Photographs were available only to university staff.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "No staff-only rule is described.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The library set aside a floor for group discussion.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "One floor was designated for group discussion.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The first questionnaire collected visitor names.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "The questionnaire was anonymous.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · Quiet seats were most in demand shortly before final examinations.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Demand peaked in the two weeks before finals.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The quiet floor was expanded during the trial.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "Its size was not increased.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · Groups generally arrived later in the day.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Groups tended to arrive later.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The extra tables were purchased from a local supplier.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "The supplier is not specified.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · Sound could travel through the stairwell between floors.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Staff observed sound travelling between floors.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The meters recorded conversations.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "They recorded sound levels, not speech.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · Both doors were fitted with soft closers.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "One was modified and one was left unchanged.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The maximum recorded level near the modified door fell.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The passage reports a lower maximum.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The two doors were used equally often during the observation period.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "Not Given",
        "evidence": "The report says usage could have differed.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · Lighting influenced some visitors’ seat choices.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "Some visitors reported that lighting limited their choices.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The report made a claim about the effect of the quiet zone on grades.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "False",
        "evidence": "The report made no claim about grades.",
        "type": "true_false_not_given"
      },
      {
        "prompt": "Passage C · The library planned to repeat the survey in another term.",
        "options": [
          "True",
          "False",
          "Not Given"
        ],
        "answer": "True",
        "evidence": "The report proposed a repeat survey.",
        "type": "true_false_not_given"
      }
    ],
    "passage": "A. Cooling a city block\n\nIn 2019, planners in the fictional city of Bellhaven began a three-year study of summer heat. They selected twelve streets with similar traffic levels but different amounts of tree cover. Sensors at pedestrian height recorded the air temperature every fifteen minutes. A separate instrument measured the temperature of road surfaces, since a cool surface does not necessarily mean that the surrounding air has cooled by the same amount.\n\nOn afternoons with clear skies, streets with mature trees were generally cooler than treeless streets. The largest difference appeared shortly after two in the afternoon. At night, however, the pattern was less consistent. Buildings sometimes prevented heat from escaping, and trees did not erase differences caused by building height. The research team warned that its measurements did not establish whether the same pattern would hold in coastal cities.\n\nBellhaven then tested a second intervention. Workers painted part of a school car park with a reflective coating. The surface cooled, but some pedestrians found the reflected sunlight uncomfortable. The council decided to monitor glare as well as temperature before using the coating near busy crossings. It also emphasized that trees and reflective surfaces could serve different purposes. Trees offered shade at walking height, while a coated roof could reduce the amount of heat entering a building.\n\nThe council’s final report recommended protecting existing mature trees and planting a variety of species. It did not promise immediate results from planting. Young trees need time to grow, and new plantings require regular watering during their first summers.\n\nB. Restoring a seed collection\n\nA university archive kept seeds collected during agricultural surveys in the early twentieth century. For decades, the collection was used mostly as a historical record. When a new laboratory opened, a team examined whether any seeds could still germinate. Labels were digitized before the packets were opened so that handwritten notes would remain available even if the paper was damaged during handling.\n\nThe team did not test every packet. It selected samples from groups with clear collection dates and enough seeds to retain some untouched material. For each selected group, one set was placed on moist paper at a constant temperature. Another set received a brief cool treatment first. Some species performed better after cooling, but others showed little difference. The team therefore resisted presenting one treatment as universally effective.\n\nA striking result came from a sample of barley. Although most of its seeds failed, a small number produced seedlings. The scientists moved them to an isolated greenhouse to prevent accidental crossing with modern varieties. They planned to compare growth habits with recent barley varieties, but the first report presented only germination results.\n\nThe project’s managers also changed how new accessions were stored. Each was divided between two locations so that a single equipment failure would be less likely to destroy the entire sample. A guide explained how researchers could request material and why requests for rare samples required additional review. The archive continued to lend photographs of the original labels without that review.\n\nC. Measuring sound in a library\n\nA library introduced a trial in which one floor was designated for quiet work and another for group discussion. Before the trial, librarians counted occupied seats at fixed times and asked visitors to complete a short anonymous questionnaire. The survey asked whether people could find an appropriate place to work. It did not collect their names or ask what they were studying.\n\nAfter the change, demand for quiet seats was highest in the two weeks before final examinations. Groups tended to arrive later in the day. When some groups moved chairs into corridors, the library installed extra tables on the discussion floor. It did not increase the size of the quiet floor during the trial. Staff also noticed that sound from a stairwell travelled between floors despite the separation.\n\nTo investigate the stairwell problem, the library placed sound meters near two doors. The meters recorded sound levels, not speech. One door was fitted with a soft closer, while the other door was left unchanged for comparison. The maximum sound level near the modified door fell during the observation period. The library nevertheless noted that door usage could have differed and that the experiment did not show how much individual visitors were disturbed.\n\nThe final report recommended keeping both zones. It also recommended a trial of desk lamps, as some visitors said that the available lighting limited their choice of seats. The report did not claim that the quiet zone improved grades. It proposed repeating the survey in another term to see whether preferences remained stable outside the examination period."
  }
]
$practice$::jsonb) loop
    insert into public.tests(id, category_id, title, section, duration, published, passage_text, description)
    values (
      (pack->>'id')::uuid,
      (select id from public.exam_categories where slug = pack->>'slug'),
      pack->>'title', pack->>'section', (pack->>'duration')::int, true,
      pack->>'passage', 'Original TAFE practice questions'
    )
    on conflict (id) do nothing
    returning id into test_id;
    if test_id is null then continue; end if;

    for item in select value as question, ordinality as position
      from jsonb_array_elements(pack->'questions') with ordinality
    loop
      insert into public.questions(test_id, prompt, options, position, type)
      values (test_id, item.question->>'prompt', item.question->'options',
        item.position - 1, item.question->>'type')
      returning id into question_id;
      insert into public.answer_keys(question_id, answer, accepted, evidence)
      values (question_id, item.question->>'answer', item.question->'answer', item.question->>'evidence');
    end loop;
  end loop;
end
$seed$;
