import _ from 'lodash';
import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Link } from 'react-router-dom';
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';
import styled from 'styled-components';

import { ACTIVE_HOSTS } from './gql';
import { orange, grayText } from '../colors';
import { processActiveHostHitSums } from './util';
import Grid from './Grid';

const Style = styled.div`
  .hostWrap {
    position: relative;
    white-space: nowrap;
    margin-bottom: 1px;
    margin-right: 0.5em;
    line-height: 1rem;
    &.loading {
      background: ${grayText.lighten(0.7)};
    }
    & > span {
      position: relative;
      text-shadow: 0.5px 0.5px 1px white;
    }
    & > div {
      position: absolute;
      top: 1px;
      bottom: 1px;
      border-radius: 0 0.5em 0.5em 0;
      background: linear-gradient(to right, 
        ${orange.alpha(0)} 0%,
        ${orange.alpha(0.2)} 50%,
        ${orange} 100%);
    }
  }
  .scroll {
    max-height: 400px;
    overflow-y: auto;
    margin-right: -8px; // todo: smarten
    overflow-x: hidden;
  }
`;

const DashboardActiveHosts = () => (
  <Grid.Item>
    <Query 
      query={ACTIVE_HOSTS} 
      variables={{ period: '1d'}} 
      pollInterval={30000}
    >
      {({ loading, error, data: {activeHosts} }) => {
        if (loading) return <Loading n={30} />;
        if (error) return `Error! ${error.message}`;
        const hosts = processActiveHostHitSums(activeHosts);
        const gw = hc => ((hc / hosts.max) * 100) + '%';
        return (
          <Style>
            <div>Active Hosts Today ({hosts.count})</div>
            <hr />
            <div className='_middle scroll'>
              { !hosts.hosts.length && 'no active hosts' }
              { hosts.hosts.map(h => (
                <div className='hostWrap' key={h.host}>
                  <div style={{ width: gw(h.hitCount) }}>&nbsp;</div>
                  <span>{h.host} ({h.hitCount})</span>
                </div>
              ))}
            </div>
          </Style>
        );
      }}
    </Query>
  </Grid.Item>
);

const Loading = ({n}) => (
  <Style>
    <div>Active Hosts Today (loading...)</div>
    <hr />
    <div className='_middle scroll'>
      {_.range(n).map(i => (
        <div className='hostWrap loading' key={i}>
          <span>&nbsp;</span>
        </div>
      ))}
    </div>
  </Style>
);

export default DashboardActiveHosts;