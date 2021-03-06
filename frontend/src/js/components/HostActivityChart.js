import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import styled from 'styled-components';
import { Dropdown } from 'semantic-ui-react';
import moment from 'moment';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

import { ALL_HOST_HITS_24HR } from './gql';
import { orange } from '../colors';
import { processAllHostHitsForChart } from './util';
import Grid from './Grid';

const Style = styled.div`
  width: 100%;
  & ._graphHead {
    margin-top: 10px;
    margin-bottom: -1.1em;
    margin-left: 20px;
    position: relative;
    z-index: 1;
  }
`;

const graphOptions = [
  { text: 'Host Activity (24h)', value: 'all'},
  { text: 'Host Activity by Device (24h)', value: 'devices'}
]

const HostActivityChart = () => (
  <Style>
    <div className='_graphHead'>
      <Dropdown 
        inline 
        options={graphOptions} 
        defaultValue={graphOptions[0].value}
      />
    </div>
    <AllHosts />
  </Style>
);

const AllHosts = () => (
  <Query 
    query={ALL_HOST_HITS_24HR} 
    variables={{ date: new Date() }} 
  >
    {({ loading, error, data: { allHostHits24hr } }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;
      const hosts = processAllHostHitsForChart(allHostHits24hr);
      return (<ActivityChart data={hosts} />);
    }}
  </Query>
);

const Maxima = (p) => {
  //console.log(p);
  const rAlign = p.width - p.cx < 50;
  const h = 1;
  const w = 20;
  if (!p.payload.maxima) { return null; }
  return (<g>
    <rect x={p.cx-(rAlign?w:0)} y={p.cy-h} width={w-2} height={h} fill='gray' />
    <text 
      x={p.cx+(rAlign?(-w):w)} 
      y={p.cy+(10/3)} 
      textAnchor={rAlign?'end':'start'} 
      fontSize="10" 
      fill="gray"
    >
      {p.payload.v}
    </text>
  </g>);
};

const ActivityChart = ({data}) =>(
  <ResponsiveContainer height={150}>
    <AreaChart data={data} margin={{ left: 0, top: 5, right: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="10%" stopColor={orange()} stopOpacity={0.8}/>
          <stop offset="95%" stopColor={orange()} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <XAxis 
        dataKey='ts' 
        interval='preserveStartEnd' 
        axisLine={false} 
        tickSize={0} 
        tick={{ fontSize: 10 }} 
      />
      {/*<YAxis dataKey='v' interval='preserveEnd' axisLine={false} tickSize={0} tick={{ fontSize: 10 }} tickMargin={-10} />*/}
      <Area 
        dot={<Maxima/>} 
        stackId='0' 
        type='monotone' 
        dataKey='v' 
        stroke='#ff7a00' 
        fillOpacity={1} 
        fill="url(#colorUv)" 
      />
      {/*<Area stackId='0' type='monotone' dataKey='pv' fill='blue' />*/}
    </AreaChart>
  </ResponsiveContainer>
);

export default HostActivityChart;



