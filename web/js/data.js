/* Demo catalog and demo accounts.
   pair  = days of send-a-film streak the demo friend already has with a new user
   today = the demo friend has already sent you a film today */
/* Replaced by TMDB data when it is enabled. */
window.CM_DATA = {
  GENRES: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy',
    'History', 'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'],

  MOVIES: [
    { id: 'm1', t: 'Dune: Part Two', y: 2024, k: 'Movie', g: ['Sci-Fi', 'Adventure'], len: '2h 46m', r: 8.5, c: ['#c86b2a', '#2a1408'], s: 0, d: 'Paul Atreides joins the Fremen, and the desert becomes the battlefield for the fate of an empire.' },
    { id: 'm2', t: 'Severance', y: 2022, k: 'Series', g: ['Thriller', 'Sci-Fi', 'Mystery'], len: '2 seasons', r: 8.7, c: ['#2b6cb0', '#0b1626'], s: 3, d: 'Office workers have their work memories surgically split from their private lives. What is their department really doing?' },
    { id: 'm3', t: 'Oppenheimer', y: 2023, k: 'Movie', g: ['Drama', 'History'], len: '3h', r: 8.3, c: ['#e2572b', '#140707'], s: 1, d: 'The physicist who led the race to build the first atomic bomb, and the price he paid for it.' },
    { id: 'm4', t: 'The Bear', y: 2022, k: 'Series', g: ['Drama', 'Comedy'], len: '3 seasons', r: 8.5, c: ['#2f855a', '#08160f'], s: 2, d: 'A young fine-dining chef comes home to Chicago to rescue the family sandwich shop.' },
    { id: 'm5', t: 'Interstellar', y: 2014, k: 'Movie', g: ['Sci-Fi', 'Drama'], len: '2h 49m', r: 8.7, c: ['#4a5568', '#05070c'], s: 1, d: 'A crew travels through a wormhole to find humanity a new home while Earth is dying.' },
    { id: 'm6', t: 'Past Lives', y: 2023, k: 'Movie', g: ['Romance', 'Drama'], len: '1h 45m', r: 7.8, c: ['#d69e8e', '#2a1a22'], s: 0, d: 'Two childhood friends meet again in New York twenty years after they were separated.' },
    { id: 'm7', t: 'Shōgun', y: 2024, k: 'Series', g: ['History', 'Drama'], len: '1 season', r: 8.6, c: ['#9b2c2c', '#120606'], s: 2, d: 'An English sailor is shipwrecked in Japan in 1600, right in the middle of a struggle for power.' },
    { id: 'm8', t: 'Arcane', y: 2021, k: 'Series', g: ['Animation', 'Fantasy', 'Action'], len: '2 seasons', r: 9.0, c: ['#805ad5', '#120a24'], s: 3, d: 'Two sisters end up on opposite sides of a war between a rich city and its undercity.' },
    { id: 'm9', t: 'La La Land', y: 2016, k: 'Movie', g: ['Musical', 'Romance'], len: '2h 8m', r: 8.0, c: ['#5a67d8', '#1a103a'], s: 0, d: 'A jazz pianist and an aspiring actress fall in love in a Los Angeles full of dreams.' },
    { id: 'm10', t: 'Breaking Bad', y: 2008, k: 'Series', g: ['Crime', 'Drama', 'Thriller'], len: '5 seasons', r: 9.5, c: ['#b7791f', '#151004'], s: 2, d: 'A chemistry teacher with a grim diagnosis starts cooking drugs to provide for his family.' },
    { id: 'm11', t: 'Parasite', y: 2019, k: 'Movie', g: ['Thriller', 'Drama'], len: '2h 12m', r: 8.5, c: ['#38a169', '#081208'], s: 3, d: 'A poor family slowly works its way into the household of the wealthy Park family.' },
    { id: 'm12', t: 'Dark', y: 2017, k: 'Series', g: ['Sci-Fi', 'Mystery'], len: '3 seasons', r: 8.7, c: ['#2d3748', '#030405'], s: 1, d: 'A missing child in a small German town exposes the secrets of four families across time.' },
    { id: 'm13', t: 'The Grand Budapest Hotel', y: 2014, k: 'Movie', g: ['Comedy', 'Adventure'], len: '1h 39m', r: 8.1, c: ['#d53f8c', '#2a0a1c'], s: 2, d: 'A legendary concierge and his lobby boy get tangled up in the theft of a priceless painting.' },
    { id: 'm14', t: 'Top Gun: Maverick', y: 2022, k: 'Movie', g: ['Action'], len: '2h 11m', r: 8.2, c: ['#dd6b20', '#1a0e05'], s: 0, d: 'A veteran pilot trains a new generation for a mission that looks impossible.' },
    { id: 'm15', t: 'Succession', y: 2018, k: 'Series', g: ['Drama'], len: '4 seasons', r: 8.9, c: ['#718096', '#0c0e12'], s: 3, d: 'Siblings fight over who will take over their ageing father\'s media empire.' },
    { id: 'm16', t: 'Whiplash', y: 2014, k: 'Movie', g: ['Drama', 'Musical'], len: '1h 47m', r: 8.5, c: ['#c53030', '#0f0303'], s: 1, d: 'A young drummer and a ruthless conductor who pushes him past every limit.' },
    { id: 'm17', t: 'The Last of Us', y: 2023, k: 'Series', g: ['Drama', 'Horror', 'Adventure'], len: '2 seasons', r: 8.7, c: ['#68875a', '#0c1209'], s: 2, d: 'A smuggler escorts a teenage girl across a post-apocalyptic America.' },
    { id: 'm18', t: 'Inside Out 2', y: 2024, k: 'Movie', g: ['Animation', 'Comedy'], len: '1h 36m', r: 7.6, c: ['#ed8936', '#2b1260'], s: 0, d: 'Riley is a teenager now, and some new, unexpected emotions move into her head.' },
    { id: 'm19', t: 'Everything Everywhere All at Once', y: 2022, k: 'Movie', g: ['Action', 'Comedy', 'Sci-Fi'], len: '2h 19m', r: 7.8, c: ['#319795', '#061717'], s: 3, d: 'A laundromat owner learns she has to save the multiverse, and her family along with it.' },
    { id: 'm20', t: 'Spider-Man: Across the Spider-Verse', y: 2023, k: 'Movie', g: ['Animation', 'Action'], len: '2h 20m', r: 8.6, c: ['#e53e3e', '#1a0730'], s: 1, d: 'Miles Morales is pulled into a web of parallel worlds full of other spider heroes.' },
    { id: 'm21', t: 'Nope', y: 2022, k: 'Movie', g: ['Horror', 'Sci-Fi'], len: '2h 10m', r: 6.8, c: ['#975a16', '#0d0a05'], s: 0, d: 'Two siblings on a remote horse ranch notice something strange hiding in the clouds.' },
    { id: 'm22', t: 'Knives Out', y: 2019, k: 'Movie', g: ['Mystery', 'Comedy', 'Crime'], len: '2h 10m', r: 7.9, c: ['#744210', '#160c03'], s: 2, d: 'A famous detective untangles the death of a crime novelist and his very suspicious family.' },
    { id: 'm23', t: 'Planet Earth II', y: 2016, k: 'Series', g: ['Documentary'], len: '1 season', r: 9.5, c: ['#2c7a7b', '#041414'], s: 3, d: 'Islands, jungles, deserts and cities, filmed up close with the animals that live there.' },
    { id: 'm24', t: 'The Lord of the Rings: The Fellowship of the Ring', y: 2001, k: 'Movie', g: ['Fantasy', 'Adventure'], len: '2h 58m', r: 8.9, c: ['#b7791f', '#0f0b03'], s: 3, d: 'A hobbit sets out with eight companions to destroy a ring that could doom the world.' },
    { id: 'm25', t: 'Stranger Things', y: 2016, k: 'Series', g: ['Sci-Fi', 'Horror'], len: '4 seasons', r: 8.7, c: ['#c53030', '#0b0410'], s: 1, d: 'Kids in a small 1980s town uncover secret experiments and a terrifying parallel world.' },
    { id: 'm26', t: 'The Office', y: 2005, k: 'Series', g: ['Comedy'], len: '9 seasons', r: 9.0, c: ['#4a5568', '#10131a'], s: 2, d: 'A mockumentary about the daily lives of employees at a paper company branch.' },
    { id: 'm27', t: 'John Wick', y: 2014, k: 'Movie', g: ['Action', 'Crime'], len: '1h 41m', r: 7.4, c: ['#2a4365', '#05080f'], s: 1, d: 'A retired hitman comes back for the people who took the last thing he had left.' },
    { id: 'm28', t: 'Free Solo', y: 2018, k: 'Movie', g: ['Documentary', 'Adventure'], len: '1h 40m', r: 8.1, c: ['#c05621', '#1a0b04'], s: 0, d: 'A climber attempts to scale El Capitan without any ropes or safety gear.' }
  ],

  MOCK: [
    { id: 'CM-2048', pair: 14, name: 'Miško Novák', color: '#9D0208', genres: ['Sci-Fi', 'Action', 'Drama'], likes: ['m1', 'm3', 'm5', 'm8', 'm10', 'm14', 'm16', 'm27', 'm24'], streak: 12, today: true },
    { id: 'CM-7731', pair: 3, name: 'Zuzka Horváthová', color: '#6A040F', genres: ['Romance', 'Musical', 'Comedy', 'Sci-Fi'], likes: ['m2', 'm5', 'm6', 'm9', 'm13', 'm8', 'm26', 'm18'], streak: 5, today: false },
    { id: 'CM-5190', pair: 0, name: 'Tomáš Kováč', color: '#370617', genres: ['Crime', 'History', 'Horror', 'Drama'], likes: ['m1', 'm4', 'm7', 'm10', 'm12', 'm17', 'm21', 'm25'], streak: 2, today: true },
    { id: 'CM-3307', pair: 27, name: 'Lea Šimková', color: '#DC2F02', genres: ['Romance', 'Animation', 'Documentary'], likes: ['m6', 'm9', 'm18', 'm13', 'm2', 'm23', 'm28'], streak: 21, today: true },
    { id: 'CM-6612', pair: 0, name: 'Peťo Baláž', color: '#5B1A2A', genres: ['Action', 'Animation', 'Thriller'], likes: ['m14', 'm20', 'm11', 'm1', 'm27'], streak: 0, today: false },
    { id: 'CM-4410', pair: 5, name: 'Nina Krajčí', color: '#8E2A1A', genres: ['Mystery', 'Comedy', 'Fantasy'], likes: ['m22', 'm24', 'm26', 'm12', 'm13'], streak: 7, today: false },
    { id: 'CM-8823', pair: 1, name: 'Adam Varga', color: '#2A2F4A', genres: ['Documentary', 'Adventure', 'Sci-Fi'], likes: ['m23', 'm28', 'm5', 'm1', 'm19'], streak: 3, today: true }
  ],

  LEVELS: ['Extra', 'Popcorn Rookie', 'Matinee Regular', 'Film Buff', 'Critic', 'Cinephile', 'Director', 'Auteur', 'Legend']
};
