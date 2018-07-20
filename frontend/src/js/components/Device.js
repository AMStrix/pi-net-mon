import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react'

import Grid from './Grid';

const Device = ({ match: { params: { mac }}}) => (
  <Grid>
    <Grid.Item full>
      Device { mac }
    </Grid.Item>
  </Grid>
);

export default Device;