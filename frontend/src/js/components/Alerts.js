import React, { Component } from "react";
import { Route, Switch, Redirect, Link } from 'react-router-dom';
import { Query } from 'react-apollo';
import styled from 'styled-components';
import moment from 'moment';

import { parseQuery } from './util';
import { ALERTS } from './gql';
import AlertItem from './AlertItem';

const Style = styled.div`
  flex-grow: 1;
  margin: 8px 8px 0 8px;
`;

const Alerts = () => (
  <Style>
    <Query query={ALERTS} >
      {({loading, error, data}) => { 
        if (loading) return 'Loading...';
        if (error) return `Error! ${error.message}`;
        return <AlertList {...data} />;
      }}
    </Query>
  </Style>
);

const AlertList = ({alerts}) => (
  <div>
    {alerts.map(a => (<AlertItem key={a.id} {...a} />))}
  </div>
);


export default Alerts;