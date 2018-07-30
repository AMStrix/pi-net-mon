import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react'

import { BRO_STATUS, DEPLOY_BRO } from './gql';
import Grid from './Grid';

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
              {(!broStatus.isDeployed || broStatus.status == 'crashed') && <Deploy />}
            </div>

          </div>
        );
      }}
    </Query>
  </Grid.Item>
);

const Deploy = () => (
  <Mutation
    mutation={DEPLOY_BRO}
    update={(cache, { data: { deploy }}) => {

    }}
  >
    {(deploy, { data }) => (
      <button onClick={deploy}> deploy </button>
    )}
  </Mutation>
);

export default DashboardBro;