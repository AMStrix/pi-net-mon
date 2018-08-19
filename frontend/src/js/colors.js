import Color from 'color';

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