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
import { orange } from '../colors';
import { processActiveHostHitSums } from './util';
import Grid from './Grid';

const Style = styled.div`
  ._hostWrap {
    position: relative;
    white-space: nowrap;
    margin-bottom: 1px;
    margin-right: 0.5em;
    line-height: 1rem;
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
  ._host {
    font-weight: bold;
    width: 50%;
    display: inline-block;
    padding-left: 0.5em;
  }
  ._scroll {
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
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;
        const hosts = processActiveHostHitSums(activeHosts);
        const gw = hc => ((hc / hosts.max) * 100) + '%';
        return (
          <Style>
            <div>Active Hosts Today ({hosts.count})</div>
            <hr />
            <div className='_middle _scroll'>
              { !hosts.hosts.length && 'no active hosts' }
              { hosts.hosts.map(h => (
                <div className='_hostWrap' key={h.host}>
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

export default DashboardActiveHosts;