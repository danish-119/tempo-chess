export type GlossaryCategory = "rules" | "openings" | "strategy" | "tactics" | "endgame" | "notation" | "playing" | "engine" | "review";

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  long?: string;
  category: GlossaryCategory;
  /** A Learn page that teaches this with examples. */
  learn?: string;
}

export const GLOSSARY_SECTIONS: { id: GlossaryCategory; title: string }[] = [
  { id: "rules", title: "Rules & basics" },
  { id: "openings", title: "Openings" },
  { id: "strategy", title: "Strategy" },
  { id: "tactics", title: "Tactics" },
  { id: "endgame", title: "Endgames" },
  { id: "notation", title: "Notation" },
  { id: "playing", title: "Time controls & ratings" },
  { id: "engine", title: "Engine & analysis" },
  { id: "review", title: "Game review" },
];

const T = (theme: string) => `/learn/tactics?t=${theme}`;

/** Beginner-friendly definitions shown on /learn/glossary and as inline hints. */
export const GLOSSARY: GlossaryEntry[] = [
  // ---- Rules & basics
  { id: "check", term: "Check", category: "rules", short: "The king is attacked.", long: "You must get out of check at once: move the king, capture the checking piece, or block the line (a knight's check can't be blocked)." },
  { id: "checkmate", term: "Checkmate", category: "rules", short: "The king is in check and there is no legal way out. The game is over.", long: "Delivering checkmate wins the game, no matter how much material either side has." },
  { id: "stalemate", term: "Stalemate", category: "rules", short: "The side to move is not in check but has no legal move. The game is a draw.", long: "A classic trap for the side that is winning: always leave the losing king a square to move to until you can mate." },
  { id: "castling", term: "Castling", category: "rules", short: "King moves two squares toward a rook, and the rook jumps over to the other side of it.", long: "Allowed only if neither piece has moved, the squares between are empty, and the king is not in check, does not pass through an attacked square and does not land in check. Kingside is O-O, queenside O-O-O." },
  { id: "en-passant", term: "En passant", category: "rules", short: "A special pawn capture: if a pawn moves two squares and lands beside an enemy pawn, that pawn may capture it as if it had moved one.", long: "It must be done immediately on the next move, or the right is lost." },
  { id: "promotion", term: "Promotion", category: "rules", short: "A pawn reaching the last rank becomes a queen, rook, bishop or knight.", long: "Usually a queen. Choosing another piece is called underpromotion — e.g. a knight to give check, or a rook to avoid stalemate.", learn: T("promotion") },
  { id: "piece-values", term: "Piece values", category: "rules", short: "Rough worth in pawns: pawn 1, knight 3, bishop 3, rook 5, queen 9.", long: "A guide, not a law: an active knight can beat a bad bishop, and two minor pieces are often better than a rook." },
  { id: "minor-major", term: "Minor / major pieces", category: "rules", short: "Minor pieces are bishops and knights; major pieces are rooks and queens." },
  { id: "draw-repetition", term: "Threefold repetition", category: "rules", short: "A draw when the same position occurs three times with the same player to move.", long: "The moves don't have to be in a row. A 'perpetual check' usually ends this way." },
  { id: "fifty-move", term: "Fifty-move rule", category: "rules", short: "A draw can be claimed after 50 moves by each side with no capture and no pawn move." },
  { id: "insufficient-material", term: "Insufficient material", category: "rules", short: "A draw when neither side can possibly mate, e.g. king vs king, or king and bishop vs king." },
  { id: "perpetual", term: "Perpetual check", category: "rules", short: "Giving check after check that the opponent can't escape, forcing a draw by repetition." },
  { id: "touch-move", term: "Touch-move", category: "rules", short: "Over the board, a piece you touch must be moved (and an enemy piece you touch must be captured) if legally possible.", long: "Say “j'adoube” (“I adjust”) before straightening a piece on its square." },
  { id: "rank-file-diagonal", term: "Rank, file, diagonal", category: "rules", short: "Ranks are the rows (1–8), files are the columns (a–h), diagonals run corner-wise." },

  // ---- Openings
  { id: "opening", term: "Opening", category: "openings", short: "The first phase of the game, roughly the first 10–15 moves.", long: "Goals: control the centre, develop pieces, castle the king to safety. Named openings are well-known move sequences.", learn: "/learn/openings" },
  { id: "development", term: "Development", category: "openings", short: "Bringing pieces from their starting squares into play.", long: "Knights and bishops first, usually before moving the queen; then castle and connect the rooks." },
  { id: "centre", term: "The centre", category: "openings", short: "The squares d4, e4, d5, e5 (and those around them).", long: "Pieces in the centre control more squares, and central pawns limit the opponent's pieces." },
  { id: "gambit", term: "Gambit", category: "openings", short: "An opening that offers a pawn (sometimes more) for quick development or attack.", long: "Examples: King's Gambit, Evans Gambit. The Queen's Gambit isn't a true sacrifice: the pawn can usually be won back." },
  { id: "fianchetto", term: "Fianchetto", category: "openings", short: "Developing a bishop to b2/g2 (or b7/g7) after moving the knight's pawn one square.", long: "The bishop then controls the long diagonal. Common in the King's Indian, Dragon and English." },
  { id: "hypermodern", term: "Hypermodern", category: "openings", short: "Controlling the centre from a distance with pieces instead of occupying it with pawns.", long: "The opponent builds a big centre, which then becomes a target." },
  { id: "book", term: "Book move / theory", category: "openings", short: "Moves found in opening databases — known, tested theory.", long: "Leaving book means you're on your own. Tempo marks book moves in reviews." },
  { id: "transposition", term: "Transposition", category: "openings", short: "Reaching the same position through a different move order." },
  { id: "early-queen", term: "Early queen moves", category: "openings", short: "Bringing the queen out early often lets the opponent develop with tempo by attacking it." },

  // ---- Strategy
  { id: "tempo", term: "Tempo", category: "strategy", short: "A unit of time in chess — one move.", long: "Gaining a tempo means making useful progress while forcing the opponent to respond, e.g. developing a piece with a threat." },
  { id: "initiative", term: "Initiative", category: "strategy", short: "Making threats that the opponent must keep answering, so you dictate the play." },
  { id: "space", term: "Space advantage", category: "strategy", short: "Controlling more of the board, usually thanks to advanced pawns.", long: "More room for your pieces to manoeuvre; the cramped side should look to trade pieces." },
  { id: "outpost", term: "Outpost", category: "strategy", short: "A square that can't be attacked by enemy pawns, ideal for a piece — especially a knight.", long: "A knight on a protected outpost in the opponent's half (like d5 or e6) can dominate the game." },
  { id: "open-file", term: "Open file", category: "strategy", short: "A file with no pawns on it. Rooks love them." },
  { id: "half-open-file", term: "Half-open file", category: "strategy", short: "A file with only the opponent's pawns on it, so your rook can pressure them." },
  { id: "seventh-rank", term: "Rook on the seventh", category: "strategy", short: "A rook on the opponent's second rank attacks pawns and traps the king — often worth a pawn or more." },
  { id: "weak-square", term: "Weak square / hole", category: "strategy", short: "A square that can no longer be defended by a pawn — a target or a home for enemy pieces." },
  { id: "pawn-structure", term: "Pawn structure", category: "strategy", short: "The arrangement of pawns, which shapes plans for the whole game.", long: "Pawns can't move backwards, so structural weaknesses are long-lasting." },
  { id: "isolated-pawn", term: "Isolated pawn", category: "strategy", short: "A pawn with no friendly pawns on the files next to it.", long: "It can't be protected by pawns, so it's a target — but it often gives active piece play. The isolated d-pawn (IQP) is the most common." },
  { id: "doubled-pawns", term: "Doubled pawns", category: "strategy", short: "Two pawns of the same colour on the same file — usually a weakness." },
  { id: "backward-pawn", term: "Backward pawn", category: "strategy", short: "A pawn that has fallen behind its neighbours and can't safely advance or be protected by them." },
  { id: "passed-pawn", term: "Passed pawn", category: "strategy", short: "A pawn with no enemy pawns in front of it or on adjacent files.", long: "“Passed pawns must be pushed.” Protected and connected passed pawns are especially strong." },
  { id: "pawn-chain", term: "Pawn chain", category: "strategy", short: "Pawns diagonally protecting each other. Attack the base of the chain — the one pawn nobody protects." },
  { id: "pawn-majority", term: "Pawn majority", category: "strategy", short: "More pawns than the opponent on one side of the board — a source of a passed pawn." },
  { id: "pawn-break", term: "Pawn break", category: "strategy", short: "A pawn move that challenges the opponent's pawns to open lines, e.g. …c5 or …f6 in the French." },
  { id: "bishop-pair", term: "Bishop pair", category: "strategy", short: "Having both bishops while the opponent doesn't — a lasting advantage in open positions." },
  { id: "good-bad-bishop", term: "Good / bad bishop", category: "strategy", short: "A bishop blocked by its own pawns on its colour is “bad”; one whose pawns are on the other colour is “good”." },
  { id: "opposite-bishops", term: "Opposite-coloured bishops", category: "strategy", short: "Each side has one bishop, on different colours. Drawish in endgames, but strong for attack in the middlegame." },
  { id: "open-closed", term: "Open / closed position", category: "strategy", short: "Open positions have few central pawns and favour bishops; closed ones have locked pawns and favour knights." },
  { id: "exchange", term: "The exchange", category: "strategy", short: "Trading a minor piece for a rook. Winning the exchange gains about two pawns of material.", long: "An exchange sacrifice gives up a rook for a minor piece to gain something else — activity, a strong square or an attack." },
  { id: "compensation", term: "Compensation", category: "strategy", short: "Non-material advantages — attack, development, initiative — that make up for being material down." },
  { id: "prophylaxis", term: "Prophylaxis", category: "strategy", short: "A move that prevents the opponent's plan before it happens.", long: "Ask “what does my opponent want to do?” before choosing your move." },
  { id: "king-safety", term: "King safety", category: "strategy", short: "Keeping the king protected, usually by castling and leaving the pawns in front of it alone." },
  { id: "luft", term: "Luft", category: "strategy", short: "German for “air”: a pawn move that gives a castled king an escape square, preventing back-rank mates." },

  // ---- Tactics
  { id: "tactic", term: "Tactic", category: "tactics", short: "A short, forcing sequence that wins material or mates, using checks, captures and threats.", learn: "/learn/tactics" },
  { id: "fork", term: "Fork", category: "tactics", short: "One piece attacks two or more enemy pieces at once; only one can be saved.", long: "Any piece can fork. Knight forks are the most famous; pawn forks are deadly because the pawn is worth less than what it attacks.", learn: T("fork") },
  { id: "pin", term: "Pin", category: "tactics", short: "A piece can't move without exposing a more valuable piece behind it.", long: "Only bishops, rooks and queens can pin. An absolute pin is to the king — the pinned piece may not legally move off the line.", learn: T("pin") },
  { id: "skewer", term: "Skewer", category: "tactics", short: "A pin in reverse: a valuable piece is attacked and must move, exposing a piece behind it.", learn: T("skewer") },
  { id: "discovered-attack", term: "Discovered attack", category: "tactics", short: "Moving one piece unveils an attack by a bishop, rook or queen behind it.", long: "If the uncovered piece gives check, it's a discovered check; if both pieces give check, it's a double check.", learn: T("discoveredAttack") },
  { id: "double-check", term: "Double check", category: "tactics", short: "Check from two pieces at once. The only defence is to move the king.", learn: T("doubleCheck") },
  { id: "double-attack", term: "Double attack", category: "tactics", short: "A move that creates two threats at once; the opponent can parry only one." },
  { id: "hanging-piece", term: "Hanging piece", category: "tactics", short: "A piece that can be captured for free — undefended, or attacked more times than it is defended.", learn: T("hangingPiece") },
  { id: "trapped-piece", term: "Trapped piece", category: "tactics", short: "A piece with no safe squares; attack it and it's lost.", learn: T("trappedPiece") },
  { id: "deflection", term: "Deflection", category: "tactics", short: "Forcing a defending piece away from the square or piece it guards.", learn: T("deflection") },
  { id: "decoy", term: "Decoy (attraction)", category: "tactics", short: "Luring an enemy piece, often the king, onto a bad square — usually with a sacrifice.", learn: T("attraction") },
  { id: "overloaded", term: "Overloaded piece", category: "tactics", short: "A defender with too many jobs; it cannot cover everything at once." },
  { id: "remove-defender", term: "Removing the defender", category: "tactics", short: "Capturing or chasing away the piece that protects something.", learn: T("capturingDefender") },
  { id: "zwischenzug", term: "Zwischenzug (in-between move)", category: "tactics", short: "Playing a stronger move — often a check — before the expected recapture.", learn: T("intermezzo") },
  { id: "x-ray", term: "X-ray", category: "tactics", short: "A long-range piece attacking or defending through another piece on the same line.", learn: T("xRayAttack") },
  { id: "sacrifice", term: "Sacrifice", category: "tactics", short: "Deliberately giving up material for a bigger gain: mate, more material, or a lasting attack." },
  { id: "back-rank", term: "Back-rank mate", category: "tactics", short: "Checkmate on the first/last rank when the king is boxed in by its own pawns.", long: "A common defence is creating luft — moving a pawn in front of the king to give it an escape square.", learn: T("backRankMate") },
  { id: "smothered-mate", term: "Smothered mate", category: "tactics", short: "A knight mates a king surrounded by its own pieces.", learn: T("smotheredMate") },
  { id: "windmill", term: "Windmill", category: "tactics", short: "A repeated discovered check: the moving piece grabs material each time while the king can only shuffle." },

  // ---- Endgames
  { id: "endgame", term: "Endgame", category: "endgame", short: "The final phase, when few pieces remain. The king becomes an attacking piece.", learn: "/practice?mode=endgames" },
  { id: "opposition", term: "Opposition", category: "endgame", short: "Kings facing each other with one square between them; the side NOT to move “has the opposition”.", long: "Key to king-and-pawn endings: the side with the opposition can force the other king to give way." },
  { id: "key-squares", term: "Key squares", category: "endgame", short: "Squares that, if your king reaches them, guarantee the pawn promotes." },
  { id: "square-rule", term: "Rule of the square", category: "endgame", short: "A quick way to tell if a king can catch a passed pawn: if it can step into the pawn's “square”, it catches it." },
  { id: "triangulation", term: "Triangulation", category: "endgame", short: "Losing a move with the king by walking a triangle, to put the opponent in zugzwang." },
  { id: "zugzwang", term: "Zugzwang", category: "endgame", short: "Any move worsens the position, but you can't pass.", long: "Common in endgames — the side to move is the one in trouble.", learn: T("zugzwang") },
  { id: "fortress", term: "Fortress", category: "endgame", short: "A defensive setup the stronger side can't break through, even with extra material — a draw." },
  { id: "lucena", term: "Lucena position", category: "endgame", short: "The basic winning method in rook endgames with an extra pawn: “build a bridge” with the rook to shield the king from checks.", learn: "/practice?mode=endgames&lesson=lucena" },
  { id: "philidor", term: "Philidor position", category: "endgame", short: "The basic drawing method against rook and pawn: keep your rook on your third rank (the sixth rank for Black) until the pawn advances, then check from behind.", learn: "/practice?mode=endgames&lesson=philidor" },
  { id: "wrong-bishop", term: "Wrong-coloured bishop", category: "endgame", short: "Bishop and rook pawn can't win if the bishop doesn't control the promotion corner.", learn: "/practice?mode=endgames&lesson=wrong-bishop" },
  { id: "tablebase", term: "Tablebase", category: "endgame", short: "A database with the perfect result of every position with few pieces (up to 7).", long: "Tempo uses the Lichess tablebase for exact endgame results in analysis and the Endgames trainer." },
  { id: "dtz-dtm", term: "DTM / DTZ", category: "endgame", short: "Distance to mate, and distance to the next capture or pawn move (“zeroing”) with perfect play." },

  // ---- Notation
  { id: "algebraic", term: "Algebraic notation", category: "notation", short: "Squares are named by file letter and rank number (a1–h8); moves by piece letter + square, e.g. Nf3.", long: "K king, Q queen, R rook, B bishop, N knight, no letter for pawns; x = capture, + = check, # = mate, O-O / O-O-O = castling, =Q = promotion." },
  { id: "san", term: "SAN", category: "notation", short: "Standard Algebraic Notation, e.g. Nf3, exd5, O-O, e8=Q+." },
  { id: "uci-notation", term: "UCI / long notation", category: "notation", short: "From-square + to-square, e.g. e2e4 or e7e8q. Used by engines." },
  { id: "annotation-symbols", term: "Annotation symbols", category: "notation", short: "!! brilliant, ! good, !? interesting, ?! dubious, ? mistake, ?? blunder." },
  { id: "fen", term: "FEN", category: "notation", short: "A one-line text description of a chess position.", long: "Includes piece placement, side to move, castling rights, en-passant square and move counters. Use it to share a position or set it up in the Board editor." },
  { id: "pgn", term: "PGN", category: "notation", short: "Portable Game Notation — the standard text format for whole games.", long: "Contains header tags (players, result, date…) followed by the moves. Chess.com, Lichess and every major chess app can export it." },
  { id: "eco", term: "ECO code", category: "notation", short: "A letter and number (A00–E99) that classifies an opening, e.g. C50 for the Italian Game." },

  // ---- Time controls & ratings
  { id: "time-control", term: "Time control", category: "playing", short: "How much time each player has, written minutes | increment, e.g. 10 | 0 or 3 | 2." },
  { id: "increment", term: "Increment", category: "playing", short: "Seconds added to your clock after every move you make." },
  { id: "speeds", term: "Bullet, blitz, rapid, classical", category: "playing", short: "Speed categories: bullet under 3 min, blitz 3–10 min, rapid 10–60 min, classical longer.", long: "Exact boundaries differ slightly between sites." },
  { id: "flag", term: "Flagging", category: "playing", short: "Running out of time. You lose — unless the opponent can't possibly mate, which is a draw." },
  { id: "premove", term: "Premove", category: "playing", short: "Entering your move before the opponent has moved, so it plays instantly. Common in bullet." },
  { id: "elo", term: "Elo / rating", category: "playing", short: "A number estimating playing strength; it goes up when you beat stronger players and down when you lose.", long: "Ratings on different sites and federations aren't directly comparable." },
  { id: "titles", term: "Titles (GM, IM, FM…)", category: "playing", short: "Titles awarded by FIDE for strong results: Grandmaster, International Master, FIDE Master, Candidate Master (and WGM, WIM… for women's titles)." },

  // ---- Engine & analysis
  { id: "evaluation", term: "Evaluation (eval)", category: "engine", short: "The engine's estimate of who is better, in pawns.", long: "+1.00 means White is better by roughly a pawn's worth; −1.00 means Black is. Tempo always shows evaluations from White's point of view, so the number does not flip when it is Black's turn." },
  { id: "centipawn", term: "Centipawn", category: "engine", short: "One hundredth of a pawn — the unit behind evaluations.", long: "An evaluation of +50 centipawns is shown as +0.50." },
  { id: "mate-score", term: "Mate score (M3, −M2)", category: "engine", short: "A forced checkmate exists in that many moves.", long: "M3 means White can force mate in 3 moves; −M2 means Black can force mate in 2. Mate scores are stronger than any pawn evaluation." },
  { id: "eval-bar", term: "Evaluation bar", category: "engine", short: "Visual version of the evaluation.", long: "The light part is White's share. It follows a win-probability curve, so +8 and +12 look similar — both are winning." },
  { id: "depth", term: "Depth", category: "engine", short: "How many half-moves deep the engine searched along its main line.", long: "Higher depth generally means a more reliable evaluation, but depth is not a fixed measure of strength: the engine prunes aggressively, and different positions need different depths. Time and depth are not interchangeable." },
  { id: "ply", term: "Ply / half-move", category: "engine", short: "One move by one side. A full move is two plies — White's and Black's." },
  { id: "principal-variation", term: "Principal variation (PV)", category: "engine", short: "The sequence of best moves the engine expects for both sides." },
  { id: "multipv", term: "MultiPV / engine lines", category: "engine", short: "Showing the engine's best few moves instead of only one.", long: "Useful to see whether a move is the only good option or one of several." },
  { id: "opening-explorer", term: "Opening explorer", category: "engine", short: "Statistics of what was played from a position in real games, and how those games ended.", long: "Tempo's Explorer tab uses the Lichess masters and Lichess game databases (connect a free Lichess account to use it)." },

  // ---- Game review
  { id: "win-probability", term: "Win probability", category: "review", short: "An evaluation converted to a 0–100% chance-like score.", long: "Tempo classifies moves by how much win probability they lose, so the same pawn lost matters more in a balanced position than in an already-won one." },
  { id: "accuracy", term: "Accuracy", category: "review", short: "Tempo's 0–100 score for how closely moves matched the engine.", long: "It is computed from the win probability lost on each move (formula on the About page). It is Tempo's own approximation." },
  { id: "brilliant", term: "Brilliant", category: "review", short: "A sound sacrifice: a near-best move that gives up at least two points of material.", long: "Tempo marks a move Brilliant when it loses under 2% win probability, really sacrifices material (the engine's best defence takes it, or the piece is left hanging), keeps you at least equal, and you were not already completely winning without it." },
  { id: "only-move", term: "Great move", category: "review", short: "The only good move: the best move when every alternative was much worse (≥15% lower win probability)." },
  { id: "best", term: "Best move", category: "review", short: "The engine's top choice in the position." },
  { id: "excellent", term: "Excellent", category: "review", short: "Loses less than 2% win probability compared with the best move." },
  { id: "good", term: "Good", category: "review", short: "Loses 2–5% win probability: a reasonable move, slightly imprecise." },
  { id: "inaccuracy", term: "Inaccuracy", category: "review", short: "Loses 5–10% win probability. Notation: ?!" },
  { id: "mistake", term: "Mistake", category: "review", short: "Loses 10–20% win probability. Notation: ?" },
  { id: "blunder", term: "Blunder", category: "review", short: "Loses 20% or more win probability — usually material or the game. Notation: ??" },
  { id: "missed-win", term: "Miss", category: "review", short: "Failing to capitalise: a winning position slips away, or you hand back the advantage right after your opponent's mistake." },
  { id: "forced", term: "Forced move", category: "review", short: "The only legal move in the position." },
  { id: "key-moment", term: "Key moment", category: "review", short: "A turning point: a large swing in the evaluation, or an only-move find." },
  { id: "time-pressure", term: "Time pressure", category: "review", short: "Moves played with little time left on the clock (under 10% of the starting time or 30 s)." },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
