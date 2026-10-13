import { DEFAULT_EXERCISES } from './exercises';

/**
 * Offline form tips for the canonical exercises, keyed by DEFAULT_EXERCISES id.
 * `steps`: how to perform a rep, in order. `avoid`: the most common mistakes.
 * Keep each line short enough to read mid-set. Custom exercises have no guide.
 */
export interface FormGuide {
  steps: readonly string[];
  avoid: readonly string[];
}

const byName: Record<string, FormGuide> = {
  'Bench Press (Barbell)': {
    steps: [
      'Eyes under the bar, feet planted flat on the floor',
      'Pinch shoulder blades together and keep a slight arch',
      'Grip just wider than shoulders, wrists stacked over elbows',
      'Lower under control to the lower chest',
      'Press up and slightly back toward your face',
    ],
    avoid: ['Bouncing the bar off your chest', 'Elbows flared straight out to 90°', 'Hips lifting off the bench'],
  },
  'Incline Bench Press (Dumbbell)': {
    steps: [
      'Bench at 30–45°, dumbbells resting on your thighs',
      'Kick them up one at a time as you lie back',
      'Shoulder blades back and down, chest up',
      'Lower until the dumbbells are level with your upper chest',
      'Press up and slightly in, without clanking them together',
    ],
    avoid: ['Bench set too steep (turns into a shoulder press)', 'Losing tension at the top'],
  },
  'Chest Fly (Cable)': {
    steps: [
      'Pulleys at shoulder height, step forward into a split stance',
      'Soft bend in the elbows; keep it fixed the whole rep',
      'Open the arms wide until you feel a chest stretch',
      'Squeeze the hands together in front of your chest',
      'Return slowly under control',
    ],
    avoid: ['Bending and straightening the elbows (turns into a press)', 'Going so heavy the shoulders roll forward'],
  },
  'Push Up': {
    steps: [
      'Hands just wider than shoulders, body in a straight line',
      'Brace your core and squeeze your glutes',
      'Lower until your chest is a fist from the floor',
      'Elbows about 45° from your body',
      'Push the floor away to full lockout',
    ],
    avoid: ['Hips sagging or piking up', 'Half reps', 'Head dropping toward the floor'],
  },
  'Deadlift (Barbell)': {
    steps: [
      'Bar over mid-foot, feet about hip-width apart',
      'Hinge down and grip just outside your legs',
      'Chest up, flat back, pull the slack out of the bar',
      'Push the floor away, bar dragging up your legs',
      'Stand tall with hips through, then hinge back down',
    ],
    avoid: ['Rounding the lower back', 'Bar drifting away from the body', 'Leaning back at lockout'],
  },
  'Bent Over Row (Barbell)': {
    steps: [
      'Hinge to about 45°, knees soft, flat back',
      'Grip just outside shoulder width, arms long',
      'Pull the bar to your lower ribs / belly button',
      'Squeeze your shoulder blades together at the top',
      'Lower with control without standing up',
    ],
    avoid: ['Using momentum from the hips', 'Rounding the back', 'Shrugging the bar up'],
  },
  'Lat Pulldown (Cable)': {
    steps: [
      'Thighs locked under the pad, grip just wider than shoulders',
      'Lean back slightly, chest up',
      'Drive elbows down toward your back pockets',
      'Bring the bar to your upper chest',
      'Let it rise slowly until your arms are straight',
    ],
    avoid: ['Pulling behind the neck', 'Swinging your torso to move the weight'],
  },
  'Pull Up': {
    steps: [
      'Hang with an overhand grip just wider than shoulders',
      'Pull shoulders down and back before bending the arms',
      'Drive elbows down until your chin clears the bar',
      'Lower all the way to a dead hang',
    ],
    avoid: ['Kipping or swinging', 'Stopping short of full extension'],
  },
  'Overhead Press (Barbell)': {
    steps: [
      'Bar on the front of your shoulders, grip just outside them',
      'Squeeze glutes and brace; ribs down',
      'Move your head back and press straight up',
      'Push your head through once the bar passes your face',
      'Lock out with the bar over mid-foot',
    ],
    avoid: ['Over-arching the lower back', 'Pressing the bar out in front of you'],
  },
  'Lateral Raise (Dumbbell)': {
    steps: [
      'Stand tall, slight bend in the elbows',
      'Raise the arms out to the sides, leading with the elbows',
      'Stop at shoulder height',
      'Lower slowly over 2–3 seconds',
    ],
    avoid: ['Swinging the weights up', 'Shrugging the traps', 'Going above shoulder height'],
  },
  'Bicep Curl (Dumbbell)': {
    steps: [
      'Stand tall, elbows pinned to your sides',
      'Palms forward, curl the weight toward your shoulders',
      'Squeeze at the top',
      'Lower all the way down under control',
    ],
    avoid: ['Swinging with the back', 'Elbows drifting forward', 'Cutting the bottom of the rep short'],
  },
  'Hammer Curl (Dumbbell)': {
    steps: [
      'Neutral grip (palms facing each other)',
      'Elbows fixed at your sides',
      'Curl up until the forearm is vertical',
      'Lower slowly to full extension',
    ],
    avoid: ['Using momentum', 'Rotating the wrists'],
  },
  'Triceps Pushdown (Straight Bar)': {
    steps: [
      'Overhand grip on a straight bar, about shoulder width',
      'Stand close to the stack, slight forward lean',
      'Elbows pinned to your sides',
      'Push down until the arms are fully straight',
      'Let the hands rise to about chest height only',
    ],
    avoid: ['Elbows flaring or moving forward', 'Leaning over the bar to push with bodyweight'],
  },
  'Skull Crusher (EZ Bar)': {
    steps: [
      'Lie on a bench, bar over your shoulders with straight arms',
      'Keep the upper arms still, angled slightly back',
      'Bend only the elbows, lowering the bar toward your forehead',
      'Extend back up to lockout',
    ],
    avoid: ['Elbows flaring out', 'Moving the upper arms (turns into a press)'],
  },
  'Squat (Barbell)': {
    steps: [
      'Bar on the upper back, feet shoulder-width, toes slightly out',
      'Big breath and brace your core',
      'Sit down and back, knees tracking over your toes',
      'Reach at least hip crease level with the knee',
      'Drive up through the whole foot',
    ],
    avoid: ['Knees caving in', 'Heels lifting', 'Chest collapsing forward'],
  },
  'Leg Press (Machine)': {
    steps: [
      'Back and hips flat against the pad',
      'Feet shoulder-width, mid-platform',
      'Lower until knees are around 90°',
      'Press through the whole foot, stopping just short of lockout',
    ],
    avoid: ['Hips peeling off the seat at the bottom', 'Snapping the knees straight'],
  },
  'Leg Extension (Machine)': {
    steps: [
      'Knee joint lined up with the machine pivot',
      'Pad just above the ankles',
      'Extend fully and squeeze the quads for a second',
      'Lower slowly',
    ],
    avoid: ['Kicking the weight up', 'Lifting the hips off the seat'],
  },
  'Romanian Deadlift (Barbell)': {
    steps: [
      'Stand tall holding the bar, knees softly bent',
      'Push your hips back, bar sliding down your thighs',
      'Keep the back flat; stop when the hamstrings are fully stretched',
      'Drive the hips forward to stand back up',
    ],
    avoid: ['Rounding the back to reach lower', 'Bending the knees into a squat'],
  },
  'Lying Leg Curl (Machine)': {
    steps: [
      'Knees just off the end of the bench',
      'Pad just above the heels, hips pressed down',
      'Curl the heels toward your glutes',
      'Lower slowly to almost straight',
    ],
    avoid: ['Hips lifting off the pad', 'Using momentum'],
  },
  'Hip Thrust (Barbell)': {
    steps: [
      'Upper back on a bench, padded bar over your hips',
      'Feet flat, shins vertical at the top',
      'Chin tucked, drive your hips up',
      'Squeeze the glutes hard at the top',
      'Lower under control',
    ],
    avoid: ['Over-arching the lower back at the top', 'Feet too far forward or back'],
  },
  'Standing Calf Raise (Machine)': {
    steps: [
      'Balls of the feet on the edge, heels free',
      'Lower the heels into a deep stretch',
      'Pause at the bottom',
      'Rise as high as possible onto your toes',
    ],
    avoid: ['Bouncing', 'Bending the knees to help'],
  },
  Plank: {
    steps: [
      'Forearms under the shoulders',
      'Straight line from head to heels',
      'Squeeze your glutes and brace your abs',
      'Breathe steadily and hold',
    ],
    avoid: ['Hips sagging', 'Hips piked high', 'Holding your breath'],
  },
  'Hanging Leg Raise': {
    steps: [
      'Dead hang with the shoulders engaged',
      'Raise the legs by curling the pelvis up',
      'Lower slowly without swinging',
    ],
    avoid: ['Swinging for momentum', 'Only lifting the thighs without curling the pelvis'],
  },
  Running: {
    steps: [
      'Tall posture with a slight forward lean',
      'Land under your hips, not out in front',
      'Short, quick steps',
      'Relaxed shoulders, arms swinging front to back',
    ],
    avoid: ['Overstriding (heel slamming far in front)', 'Tense shoulders'],
  },
  Cycling: {
    steps: [
      'Saddle height: slight knee bend at the bottom of the stroke',
      'Knees track straight over the pedals',
      'Stable upper body, relaxed grip',
      'Smooth circles; pull as well as push',
    ],
    avoid: ['Saddle too low', 'Rocking your hips side to side'],
  },
  'Rowing (Machine)': {
    steps: [
      'Sequence: legs, then lean back, then arms',
      'Return: arms, then lean forward, then legs',
      'Pull the handle to your lower ribs',
      'Drive mostly with the legs',
    ],
    avoid: ['Pulling with the arms first', 'Rounding the back'],
  },
  'Seated Row (Cable)': {
    steps: [
      'Sit tall, feet on the platform, knees slightly bent',
      'Grab the handle with arms long and shoulders stretched forward',
      'Pull the handle to your belly button, elbows close to your body',
      'Squeeze the shoulder blades together, chest up',
      'Let the arms straighten slowly without rounding forward',
    ],
    avoid: ['Rocking the torso back and forth', 'Shrugging the shoulders up', 'Rounding the lower back'],
  },
  'Bicep Curl (Cable)': {
    steps: [
      'Straight or EZ bar on a low pulley, underhand grip',
      'Stand tall a step back from the stack, elbows at your sides',
      'Curl up until the forearms are vertical',
      'Squeeze, then lower slowly to full extension',
    ],
    avoid: ['Elbows drifting forward', 'Leaning back to swing the weight'],
  },
  'Hammer Curl (Cable Rope)': {
    steps: [
      'Rope on a low pulley, palms facing each other',
      'Elbows pinned to your sides',
      'Curl the rope up, keeping the thumbs on top',
      'Lower slowly until the arms are straight',
    ],
    avoid: ['Swinging the hips', 'Letting the elbows travel forward'],
  },
  'Zottman Curl (Dumbbell)': {
    steps: [
      'Palms facing forward, curl the dumbbells up',
      'At the top, rotate the wrists so the palms face down',
      'Lower slowly with the palms down (works the forearms)',
      'Rotate back to palms up at the bottom',
    ],
    avoid: ['Rushing the lowering phase', 'Using a weight too heavy to control palms-down'],
  },
  'Wrist Curl (Dumbbell)': {
    steps: [
      'Sit with forearms on your thighs or a bench, palms up',
      'Wrists just past the edge, let the dumbbell roll toward the fingers',
      'Curl the wrist up as high as it goes',
      'Lower slowly to a full stretch',
    ],
    avoid: ['Lifting the forearms off the support', 'Bouncing through short reps'],
  },
  'Reverse Wrist Curl (Dumbbell)': {
    steps: [
      'Forearms on your thighs or a bench, palms down',
      'Let the wrist drop down under control',
      'Raise the back of the hand up as high as it goes',
      'Lower slowly',
    ],
    avoid: ['Going too heavy (this muscle is small)', 'Moving the elbows'],
  },
  'Wrist Rotation (Dumbbell)': {
    steps: [
      'Hold a light dumbbell (or one end of it) with the forearm supported',
      'Rotate the palm up (out), then turn it all the way down (in)',
      'Move slowly through the full range each way',
      'Keep the elbow still; only the forearm turns',
    ],
    avoid: ['Using momentum to flip the weight', 'Letting the elbow lift or swing'],
  },
  'Incline Bench Press (Barbell)': {
    steps: [
      'Bench at 30–45°, eyes under the bar',
      'Shoulder blades back and down, feet planted',
      'Grip just wider than shoulders',
      'Lower to the upper chest, just below the collarbone',
      'Press straight up over the shoulders',
    ],
    avoid: ['Bench too steep', 'Bouncing the bar off the chest', 'Hips lifting off the bench'],
  },
  'Chest Fly (Dumbbell)': {
    steps: [
      'Lie flat, dumbbells above the chest, palms facing each other',
      'Soft bend in the elbows; keep it fixed the whole rep',
      'Open the arms wide until you feel a chest stretch',
      'Bring the dumbbells back together in an arc',
    ],
    avoid: ['Turning it into a press by bending the elbows', 'Going so deep the shoulders hurt'],
  },
  'Incline Chest Fly (Dumbbell)': {
    steps: [
      'Bench at about 30°, dumbbells above the upper chest',
      'Soft bend in the elbows, palms facing each other',
      'Open wide in an arc until you feel a stretch',
      'Squeeze back up over the upper chest',
    ],
    avoid: ['Bench set too steep', 'Elbows bending and straightening each rep'],
  },
  'Pec Deck (Machine)': {
    steps: [
      'Seat height so the handles are at chest level',
      'Back flat against the pad, slight bend in the elbows',
      'Bring the handles together in front of your chest',
      'Squeeze, then let them open slowly to a stretch',
    ],
    avoid: ['Letting the weight slam back', 'Shoulders rolling forward off the pad'],
  },
  'Lateral Raise (Cable)': {
    steps: [
      'Low pulley, stand side-on and hold the handle with the far hand',
      'Slight bend in the elbow, slight forward lean',
      'Raise the arm out to the side to shoulder height',
      'Lower slowly; keep tension at the bottom',
    ],
    avoid: ['Shrugging the shoulder up', 'Swinging the body to lift the weight'],
  },
  'Band Pull-Apart': {
    steps: [
      'Hold a band at shoulder height, arms straight, hands shoulder-width',
      'Pull the band apart by moving the hands out to the sides',
      'Squeeze the shoulder blades together at the end',
      'Return slowly to the start',
    ],
    avoid: ['Shrugging the shoulders', 'Bending the elbows to cheat the range', 'Arching the lower back'],
  },
  'Rear Delt Fly (Dumbbell)': {
    steps: [
      'Hinge forward (or lie chest-down on an incline bench)',
      'Dumbbells hanging, palms facing each other, slight elbow bend',
      'Raise the arms out to the sides, leading with the elbows',
      'Pause at shoulder height, lower slowly',
    ],
    avoid: ['Pinching the shoulder blades hard (takes it off the rear delts)', 'Swinging the torso'],
  },
  'Shoulder Press (Dumbbell)': {
    steps: [
      'Sit upright (back supported) or stand with a braced core',
      'Dumbbells at shoulder height, palms forward or slightly in',
      'Press up until the arms are straight overhead',
      'Lower back to shoulder height under control',
    ],
    avoid: ['Arching the lower back', 'Cutting the range short at the bottom'],
  },
  'Shoulder Press (Machine)': {
    steps: [
      'Seat height so the handles start at shoulder level',
      'Back flat against the pad, core braced',
      'Press up until the arms are almost straight',
      'Lower slowly back to shoulder height',
    ],
    avoid: ['Lifting the hips or back off the seat', 'Locking out hard at the top'],
  },
  'Triceps Pushdown (Rope)': {
    steps: [
      'Rope on a high pulley, palms facing each other',
      'Elbows pinned to your sides, slight forward lean',
      'Push down and spread the rope ends apart at the bottom',
      'Let the hands rise to about chest height only',
    ],
    avoid: ['Elbows moving forward', 'Using bodyweight to push the stack'],
  },
  Dip: {
    steps: [
      'Support yourself on parallel bars, arms straight',
      'Stay fairly upright for triceps (lean forward for more chest)',
      'Lower until the upper arms are about parallel to the floor',
      'Press back up to straight arms',
    ],
    avoid: ['Dropping too deep if the shoulders hurt', 'Shoulders shrugging up to the ears', 'Swinging the legs'],
  },
  'Battle Rope': {
    steps: [
      'Feet shoulder-width, knees bent, hips back, chest up',
      'Hold one rope end in each hand, arms in front',
      'Whip the arms up and down to send waves to the anchor',
      'Keep the core braced and breathe steadily',
    ],
    avoid: ['Standing up straight', 'Arms only, no leg drive', 'Ropes slack between waves'],
  },
  'Decline Chest Press (Cable)': {
    steps: [
      'Pulleys set high, one handle in each hand, staggered stance',
      'Lean slightly forward, elbows bent, hands by the chest',
      'Press down and forward until the hands meet at lower-chest height',
      'Return slowly until you feel a stretch across the chest',
    ],
    avoid: ['Shrugging the shoulders', 'Locking the elbows hard', 'Letting the cables yank you back'],
  },
};

/** Guides keyed by canonical exercise id. */
export const FORM_GUIDES: Readonly<Record<string, FormGuide>> = Object.fromEntries(
  DEFAULT_EXERCISES.flatMap((e) => (byName[e.name] ? [[e.id, byName[e.name]!]] : [])),
);

export const getFormGuide = (exerciseId: string): FormGuide | null => FORM_GUIDES[exerciseId] ?? null;
