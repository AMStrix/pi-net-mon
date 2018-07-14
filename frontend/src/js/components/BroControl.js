import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react'

const BRO_STATUS = gql`
  query broStatus {
    broStatus {
      isDeployed
    }
  }
`;

const BroControl = () => (
  <Query query={BRO_STATUS} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <pre>
        BroControl
        {data}</pre>
      );
    }}
  </Query>
);

export default BroControl;