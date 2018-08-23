import Color from 'color';
import _ from 'lodash';

function c(str) {
  const col = Color(str);
  const fn = () => col.toString();
  Object.getOwnPropertyNames(col.__proto__) // proxy so styled-components can deal
    .filter(k => typeof col[k] === 'function')
    .forEach(k => (fn[k] = 
      function() { return (col[k].apply(col, arguments)).toString() }
    ));
  return fn;
}

module.exports = {
  background: '#f1f1f1',
  blue: 'rgba(118,166,255,1)',
  lightBlue: 'rgba(118,166,255,0.5)',
  orange: c('rgb(255, 122, 0)'),
  grayText: c('#888888'),
  green: c('#008000'),
  gray: c('#808080'),
  chart: [
    c('#063951'), // dk blue
    c('#c13019'), // red
    c('#f46f11'), // orange
    c('#ebcb39'), // yellow
    c('#a2b968'), // green
    c('#0c94bc')  // lt blue
  ]
}

const levelKeys = [
  { k: 0, color: Color('rgb(33, 133, 208)') }, // blue
  { k: 0.33, color: Color('rgb(251, 189, 8)') }, // yellow
  { k: 0.66, color: Color('rgb(242, 113, 28)') }, // orange
  { k: 1, color: Color('rgb(219, 40, 40)') }  // red
];

module.exports.level = l => {
  l < 0 && (l = 0);
  l > 1 && (l = 1);
  const start = _.findLast(levelKeys, x => x.k <= l);
  const end = _.find(levelKeys, x => x.k > start.k );
  if (end) {
    const mix = (l - start.k) / (end.k - start.k);
    //console.log(`level: ${l} start: ${start.k} end: ${end.k} mix: ${mix}`);
    return c(start.color.mix(end.color, mix).toString());
  } else {
    return c(start.color.toString());
  }
}