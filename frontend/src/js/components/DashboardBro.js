import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react'

import Grid from './Grid';

const BRO_STATUS = gql`
  query broStatus {
    broStatus {
      version
      isDeployed
      status
      errors
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

const DashboardBro = () => (
  <Grid.Item>
    <Query query={BRO_STATUS} pollInterval={5000}>
      {({ loading, error, data: {broStatus} }) => {
        if (loading) return "Loading...";
        if (error) return `Error! ${error.message}`;

        return (
          <div>
            <div>{broStatus.version}</div>
            <hr/>
            <div className='_middle'>
              status: {broStatus.status} <br/>
              deployed: {broStatus.isDeployed ? 'yes' : 'no'} <br/>
              errors: {broStatus.errors.length} <br/>
              {!broStatus.isDeployed && <Deploy />}
            </div>

          </div>
        );
      }}
    </Query>
  </Grid.Item>
);

const Deploy = () => (
  <Mutation
    mutation={DEPLOY}
    update={(cache, { data: { deploy }}) => {

    }}
  >
    {(deploy, { data }) => (
      <button onClick={deploy}> deploy </button>
    )}
  </Mutation>
);

export default DashboardBro;