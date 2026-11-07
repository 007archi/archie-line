// Ready-made habits, grouped by category. Tap one in the library sheet to add it.
// Categories follow habitbox.app's "What habits to track" guide, plus a Studio group for architects.
const E = [0, 1, 2, 3, 4, 5, 6];
const WD = [1, 2, 3, 4, 5];
const SAT = [6];
const SUN = [0];
const FRI = [5];

// [name, slot, kind, target, days, essential]
const RAW = {
  Studio: [
    ['Hand-draft one detail', 'studio', 'check', 1, WD, false],
    ['Model making', 'studio', 'minutes', 30, [2, 4, 6], false],
    ['Study a precedent drawing', 'morning', 'minutes', 20, E, false],
    ['Site photo log', 'field', 'check', 1, E, false],
    ['Portfolio update', 'evening', 'check', 1, SAT, false],
    ['Sketch a building on the way', 'field', 'check', 1, E, false],
  ],
  'Health & fitness': [
    ['Drink water (glasses)', 'studio', 'count', 8, E, true],
    ['8,000 steps', 'field', 'check', 1, E, false],
    ['Strength workout', 'field', 'minutes', 30, [2, 5], false],
    ['Stretch / mobility', 'morning', 'minutes', 10, E, false],
    ['Fruit & veg servings', 'evening', 'count', 5, E, false],
    ['Vitamins / medication', 'morning', 'check', 1, E, true],
    ['Walk after a meal', 'field', 'minutes', 10, E, false],
    ['No alcohol today', 'evening', 'check', 1, E, false],
    ['Floss', 'evening', 'check', 1, E, false],
    ['Cook one meal at home', 'evening', 'check', 1, E, false],
  ],
  'Sleep & rest': [
    ['Sleep 7+ hours', 'morning', 'check', 1, E, true],
    ['In bed by set time', 'evening', 'check', 1, E, false],
    ['Consistent wake time', 'morning', 'check', 1, E, false],
    ['No caffeine after 2pm', 'studio', 'check', 1, E, false],
    ['No phone in bed', 'evening', 'check', 1, E, false],
    ['Wind-down routine', 'evening', 'minutes', 15, E, false],
    ['Short nap (under 20 min)', 'studio', 'check', 1, WD, false],
  ],
  'Focus & deep work': [
    ['Deep work session', 'studio', 'minutes', 90, WD, true],
    ['Pomodoro rounds (25 min)', 'studio', 'count', 4, WD, false],
    ['Eat the frog before noon', 'morning', 'check', 1, WD, false],
    ['Time-block tomorrow', 'evening', 'check', 1, WD, false],
    ['Inbox zero by end of day', 'studio', 'check', 1, WD, false],
    ['Close all tabs at day’s end', 'evening', 'check', 1, WD, false],
    ['Weekly review', 'evening', 'check', 1, FRI, true],
  ],
  'Money & finances': [
    ['Log spending', 'evening', 'check', 1, E, false],
    ['No-spend day', 'evening', 'check', 1, [3], false],
    ['Check bank balance', 'morning', 'check', 1, E, false],
    ['Pack lunch', 'morning', 'check', 1, WD, false],
    ['24-hour rule on impulse buys', 'evening', 'check', 1, E, false],
    ['Add to savings', 'evening', 'check', 1, SUN, false],
    ['Review one bill or subscription', 'evening', 'check', 1, SUN, false],
  ],
  'Relationships': [
    ['Reach out to one person', 'evening', 'check', 1, E, false],
    ['Call family', 'evening', 'check', 1, [0, 3], false],
    ['Quality time with partner', 'evening', 'minutes', 30, E, false],
    ['No phone during meals', 'evening', 'check', 1, E, false],
    ['Say thank you to someone', 'studio', 'check', 1, E, false],
    ['One small act of kindness', 'field', 'check', 1, E, false],
    ['Plan a weekly hangout', 'evening', 'check', 1, FRI, false],
  ],
  'Personal growth': [
    ['Journal three lines', 'evening', 'check', 1, E, false],
    ['Three gratitudes', 'evening', 'count', 3, E, false],
    ['Set a daily intention', 'morning', 'check', 1, E, false],
    ['One win, one lesson', 'evening', 'check', 1, E, false],
    ['Review your goals', 'evening', 'check', 1, SUN, false],
    ['Step outside your comfort zone', 'field', 'check', 1, E, false],
  ],
  'Mindfulness': [
    ['Meditate', 'morning', 'minutes', 5, E, true],
    ['Box breathing rounds', 'studio', 'count', 4, E, false],
    ['Name your emotion', 'evening', 'check', 1, E, false],
    ['Body scan', 'evening', 'minutes', 10, E, false],
    ['Worry window (10 min)', 'evening', 'minutes', 10, E, false],
    ['Time in nature', 'field', 'minutes', 20, E, false],
    ['Log one small win', 'evening', 'check', 1, E, false],
  ],
  'Learning': [
    ['Read pages', 'evening', 'count', 10, E, false],
    ['Practice a skill', 'studio', 'minutes', 20, E, false],
    ['Learn five new words', 'morning', 'count', 5, E, false],
    ['One course lesson', 'evening', 'check', 1, WD, false],
    ['Write to think (200 words)', 'morning', 'check', 1, E, false],
    ['Language practice', 'morning', 'minutes', 15, E, false],
    ['Review flashcards', 'studio', 'count', 20, E, false],
    ['Note one thing you learned', 'evening', 'check', 1, E, false],
  ],
  'Digital & screen time': [
    ['No phone in the first hour', 'morning', 'check', 1, E, true],
    ['Screen-time under limit', 'evening', 'check', 1, E, false],
    ['Notifications off after 9pm', 'evening', 'check', 1, E, false],
    ['Social-media-free day', 'evening', 'check', 1, SUN, false],
    ['Charge phone outside the bedroom', 'evening', 'check', 1, E, false],
    ['Offline hobby session', 'evening', 'minutes', 30, E, false],
    ['Digital sunset (1 hr before bed)', 'evening', 'check', 1, E, false],
  ],
  'Home & environment': [
    ['Make your bed', 'morning', 'check', 1, E, false],
    ['Tidy for 10 minutes', 'evening', 'minutes', 10, E, false],
    ['Dishes done before bed', 'evening', 'check', 1, E, false],
    ['Clear one surface', 'evening', 'check', 1, E, false],
    ['Water the plants', 'morning', 'check', 1, [1, 4], false],
    ['Prep clothes for tomorrow', 'evening', 'check', 1, WD, false],
    ['Declutter one item', 'evening', 'check', 1, E, false],
  ],
  'Creativity': [
    ['Morning pages', 'morning', 'check', 1, E, false],
    ['Sketch or doodle', 'field', 'minutes', 10, E, false],
    ['Play an instrument', 'evening', 'minutes', 10, E, false],
    ['Capture one idea', 'studio', 'check', 1, E, false],
    ['Take one photo', 'field', 'check', 1, E, false],
    ['Creative project time', 'evening', 'minutes', 30, E, false],
    ['Free-write five minutes', 'morning', 'minutes', 5, E, false],
    ['Share one thing you made', 'evening', 'check', 1, SUN, false],
  ],
};

export const LIBRARY = Object.entries(RAW).map(([category, items]) => ({
  category,
  items: items.map(([name, slot, kind, target, days, essential]) => ({ name, slot, kind, target, days, essential })),
}));
