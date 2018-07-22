import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Link } from 'react-router-dom';
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';
import styled from 'styled-components';

import Grid from './Grid';

const REMOTE_HOSTS = gql`
  query remoteHosts($sortField: String, $sortDir: Int, $skip: Int, $limit: Int) {
    remoteHosts(sortField: $sortField, sortDir: $sortDir, skip: $skip, limit: $limit) {
      host
      latestHit
      latestMac
      assocHost
      sources
      protocols
      services
      macs
    }
  }
`;

const DEPLOY = gql`
  mutation deploy {
    deployBro {
      isDeployed
      status
      errors
    }
  }
`;

const Style = styled.div`
  ._subtle {
    white-space: nowrap;
    color: gray;
  }
  ._host {
    width: 99%;
  }
`;

const DashboardRemoteHosts = () => (
  <Grid.Item gridWidths={2}>
    <Query 
      query={REMOTE_HOSTS} 
      variables={{ sortField: 'latestHit', sortDir: -1, skip: 0, limit: 20 }} 
      pollInterval={30000}
    >
      {({ loading, error, data: {remoteHosts} }) => {
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;

        return (
          <Style>
            <div>Hosts</div>
            <hr />
            <div className='_middle'>
              <table>
                <tbody>
              { remoteHosts.map(h => (
                <tr key={h.host}>
                  <td className='_subtle'>{h.services}</td>
                  <td className='_host'>{h.host}</td>
                  <td><Link to={'/devices/'+h.latestMac} >{h.latestMac}</Link></td>
                  <td className='_subtle'>
                    {moment(h.latestHit).from(new Date())}
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          </Style>
        );
      }}
    </Query>
  </Grid.Item>
);

export default DashboardRemoteHosts;