import _ from 'lodash';
import React, { Component } from 'react';
import { Query } from 'react-apollo';
import { Link } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';
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

import { processDeviceHitsForChart } from './util';
import { DEVICE_HITS_24HR } from './gql';
import { chart } from '../colors';
import Value from './Value';

const Style = styled.div`
  .pieHost {
    font-size: 0.9em;
  }
  .PieChart {
    position: relative;
    float: left;
    margin-right: 6px;
    & span {
      position: absolute;
      text-align: center;
      left: 0;right: 0;
      font-size: 18px;
      line-height: 18px;
      font-weight: bold;
    }
  }
`;

const DeviceHostChart = p => (
  <Query query={DEVICE_HITS_24HR} variables={{ mac: p.mac, date: new Date() }}>
  {({loading, error, data}) => {
    if (loading) return 'Loading...';
    if (error) return `Error! ${error.message}`;
    const hits = processDeviceHitsForChart(data.deviceHits24hr);
    return (
      (hits.totalOtherSum === 0 && _.values(hits.topHosts).reduce((a,x)=>x+a,0) === 0) &&
      <Value small label='host activity' value='no host activity in last 24h' /> ||
      <Style>
        <ResponsiveContainer height={150}>
          <AreaChart data={hits.data} margin={{ left: 0, top: 0, right: 0, bottom: 0 }}>
            <XAxis 
              dataKey='ts' 
              interval='preserveStartEnd' 
              axisLine={false} 
              tickSize={0} 
              tick={{ fontSize: 10 }} 
            />
            { hits.topHosts.map((x, i) => (
                <Area 
                  key={x.h}
                  stackId='0' 
                  type='monotone' 
                  dataKey={ z => z.h[x.h] } 
                  stroke={chart[i].darken(0.5)} 
                  fillOpacity={1} 
                  fill={chart[i]()} 
                />
              ))
            }
            <Area 
              stackId='0' 
              type='monotone' 
              dataKey='otherSum' 
              stroke={chart[5].darken(0.5)} 
              fillOpacity={1} 
              fill={chart[5]()} 
            />
            {/*<Area stackId='0' type='monotone' dataKey='pv' fill='blue' />*/}
          </AreaChart>
        </ResponsiveContainer>
        <div>
          <HostPie size={110} data={
            hits.topHosts
              .map(h => ({ name: h.h, value: h.v }))
              .concat([{ name: 'others', value: hits.totalOtherSum }])
          } />
          { hits.topHosts
              .concat({ h: 'others', v: hits.totalOtherSum })
              .map((h, i) => (
                <div key={h.h} className='pieHost'>
                  <Icon name='circle' style={{ color: chart[i]() }} />
                    <Link to={'/hosts/' + h.h}>{h.h}</Link> {h.v}
                </div>
              ))
          }
        </div>
        <div style={{ clear: 'both' }} />
      </Style>
    );
  }}
  </Query>
);

const HostPie = ({data, size}) => (
  <div className='PieChart'>
    <span style={{ top: (size/2 - 9) + 'px' }}>24hr</span>
    <PieChart width={size} height={size}>
      <Pie 
        data={data}
        dataKey='value'
        innerRadius={size * 0.3}
        outerRadius={size * 0.5}
        paddingAngle={0.5}
      >
        {data.map((v, i) => <Cell key={v.name} fill={chart[i]()} />)}
      </Pie>
    </PieChart>
  </div>
);

export default DeviceHostChart;