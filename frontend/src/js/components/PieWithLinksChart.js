import _ from 'lodash';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';
import styled from 'styled-components';
import { 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

import { chart as chartColors } from '../colors';

const Style = styled.div`

`;

const PieStyle = styled.div`
  display: flex;
  .pie {
    position: relative;
    margin-right: 6px;
  }
  & span {
    position: absolute;
    text-align: center;
    left: 0;right: 0;
    font-size: 18px;
    line-height: 18px;
    font-weight: bold;
  }
  .link {
    font-size: 0.9em;
  }
`;

class PieWithLinksChart extends Component {
  state = {};
  render() {
    return (
      <Style>
        <ThePie {...this.props} />
      </Style>
    );
  }
}

const ThePie = ({data, size, label, makeLink, makeLinkLabel}) => (
  <PieStyle>
    <div className='pie'>
      <span style={{ top: (size / 2 - 9) + 'px' }}>{label}</span>
      <PieChart width={size} height={size}>
        <Pie 
          data={data}
          dataKey='v'
          innerRadius={size * 0.3}
          outerRadius={size * 0.5}
          paddingAngle={0.5}
        >
          {data.map((v, i) => <Cell key={'v'} fill={chartColors[i]()} />)}
        </Pie>
      </PieChart>
    </div>
    <div>
    {data.map((x, i) => (
      <div key={x.k} className='link'>
        <Icon name='circle' style={{ color: chartColors[i]() }} />
          <Link to={makeLink(x)}>{makeLinkLabel && makeLinkLabel(x) || x.k}</Link> {x.v}
      </div>
    ))}
    </div>
  </PieStyle>
);

export default PieWithLinksChart;