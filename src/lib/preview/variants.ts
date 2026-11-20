export const VARIANTS = [
  {
    slug: 'postcard',
    name: 'Postcard',
    idea: 'The city as a postcard you were sent; rent is the postage.'
  },
  { slug: 'survey', name: 'Survey map', idea: 'The map is the page; a rent ruler is its legend.' },
  {
    slug: 'paycheck',
    name: 'Paycheck',
    idea: 'Your month as proportional blocks; the city lives inside the rent block.'
  },
  {
    slug: 'highway',
    name: 'Highway signs',
    idea: 'Nearby towns as exit signs with miles and rent.'
  },
  {
    slug: 'forecast',
    name: 'Forecast',
    idea: 'Affordability read like a weather report for the area.'
  }
] as const;
