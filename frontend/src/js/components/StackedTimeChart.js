import _ from 'lodash';
import React, { Component } from 'react';
import styled from 'styled-components';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

import { chart as chartColors } from '../colors';

const Style = styled.div`

`;

class StackedTimeChart extends Component {
  state = {};
  render() {
    return (
      <Style>
        <Chart {...this.props} />
      </Style>
    );
  }
}

const Chart = p => p.data && (
  <ResponsiveContainer height={150} >
  <AreaChart data={p.data} margin={{ left: 0, top: 0, right: 0, bottom: 0 }}>
    <XAxis 
      dataKey='ts' 
      interval='preserveStartEnd' 
      axisLine={false} 
      tickSize={0} 
      tick={{ fontSize: 10 }} 
    />
    { p.data[0].vals.map((x, i) => (
        <Area 
          key={x.k}
          stackId='0' 
          type='monotone' 
          dataKey={ z => _.find(z.vals, { k: x.k }).v }
          stroke={chartColors[i].darken(0.5)} 
          fillOpacity={1} 
          fill={chartColors[i]()} 
        />
      ))
    }
  </AreaChart>
  </ResponsiveContainer>
) || null;

export default StackedTimeChart;