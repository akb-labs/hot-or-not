'use strict';

const TEMP_CONTEXT = new Map([
  [-25, 'Extreme cold — parts of Canada in winter'],
  [-18, 'Typical home freezer temperature'],
  [-10, 'Very cold winter day'],
  [0,   'Freezing point of water'],
  [5,   'Cold winter day'],
  [10,  'Cool autumn morning'],
  [15,  'Light jacket weather'],
  [16,  'Mild spring day'],
  [20,  'Comfortable room temperature'],
  [22,  'Ideal indoor temperature'],
  [25,  'Warm day'],
  [28,  'Beach weather'],
  [30,  'Hot summer day'],
  [35,  'Very hot day'],
  [37,  'Human body temperature'],
  [38,  'High fever'],
  [40,  'Dangerously hot — heat advisory territory'],
  [50,  'Extreme heat — hottest places on Earth'],
]);

/**
 * Returns the real-world context string for a Celsius value, or null if none.
 * @param {number} celsius
 * @returns {string|null}
 */
function getContext(celsius) {
  return TEMP_CONTEXT.get(celsius) ?? null;
}

module.exports = { getContext };
