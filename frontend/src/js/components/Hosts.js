import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Route, Switch, Redirect, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';
import { AreaChart, Area, XAxis, ResponsiveContainer } from 'recharts';

import { processActiveHostsHourlySums } from './util';
import Grid from './Grid';

const ACTIVE_HOSTS = gql`
  query activeHosts($period: String) {
    activeHosts(period: $period) {
      host
      hits
    }
  }
`;

const Hosts = ({ match: { url }}) => (
    <Switch>
      {/*<Route path={url + '/:host'} component={Host} />*/}
      <Route 
        path={url} 
        exact={true} 
        render={() => (
          <Grid>
            <div style={{ width: '100%' }}>
              <div>Hosts</div>
              <Activity />
            </div>
          </Grid>
        )} 
      />
    </Switch>
);

const Activity = () => (
  <Query 
    query={ACTIVE_HOSTS} 
    variables={{ period: '1d'}} 
    pollInterval={1000*60*10}
  >
    {({ loading, error, data: { activeHosts } }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;
      const hosts = processActiveHostsHourlySums(activeHosts);
      return (
        <ActivityChart data={hosts} />
      );
    }}
  </Query>
);

const ActivityChart = ({data}) =>(
  <ResponsiveContainer height={150}>
    <AreaChart data={data} margin={{ left: 0, top: 0, right: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="10%" stopColor="#ff7a00" stopOpacity={0.8}/>
          <stop offset="95%" stopColor="#ff7a00" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <XAxis dataKey='ts' interval='preserveStartEnd' axisLine={false} tickSize={0} tick={{ fontSize: 10 }} />
      <Area stackId='0' type='monotone' dataKey='v' stroke='#ff7a00' fillOpacity={1} fill="url(#colorUv)" />
      {/*<Area stackId='0' type='monotone' dataKey='pv' fill='blue' />*/}
    </AreaChart>
  </ResponsiveContainer>
);

export default Hosts;