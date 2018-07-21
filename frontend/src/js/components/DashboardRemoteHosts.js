import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react';
import moment from 'moment';

import Grid from './Grid';

const REMOTE_HOSTS = gql`
  query remoteHosts {
    remoteHosts {
      host
      latestHit
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

const DashboardRemoteHosts = () => (
  <Grid.Item gridWidths={2}>
    <Query query={REMOTE_HOSTS} pollInterval={30000}>
      {({ loading, error, data: {remoteHosts} }) => {
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;

        return (
          <div>
            <div>Remote Hosts</div>
            <hr />
            <div className='_middle'>
              { remoteHosts.map(h => (
                <div key={h.host}>
                  {h.host} 
                  <div style={{float:'right'}}>
                    {moment(h.latestHit).from(new Date())}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </Query>
  </Grid.Item>
);

export default DashboardRemoteHosts;