import React, { Component } from "react";
import { Route, Switch, Redirect, Link } from 'react-router-dom';
import { Query } from 'react-apollo';
import styled from 'styled-components';
import { Message } from 'semantic-ui-react';
import moment from 'moment';

import { parseQuery } from './util';
import { ALERTS } from './gql';
import AlertItem from './AlertItem';

const Style = styled.div`
  flex-grow: 1;
  margin: 8px 8px 0 8px;
`;

const Alerts = ({ match: { url }}) => (
  <Switch>
    <Route path={url + '/archived'} render={() => <AlertsContent archived={true} />} />
    <Route path={url} exact={true} component={AlertsContent} />
  </Switch>
);

const AlertsContent = ({archived}) => (
  <Style>
    <Query 
      query={ALERTS} 
      variables={{ archived: archived }} 
      pollInterval={5000}
      fetchPolicy='cache-and-network'
    >
      {({loading, error, data, refetch}) => { 
        if (!data.alerts && loading) return 'Loading...';
        if (error) return `Error! ${error.message}`;
        if (data.alerts.length === 0) return archived ? <NoArchivedAlerts /> : <NoAlerts />;
        return (
          <div>
            <AlertList {...data} refetchAlerts={refetch} />
            { !archived && <ViewArchived /> }
          </div>
        );
      }}
    </Query>
  </Style>
);

const ViewArchived = p => (
  <Message>
    View archived alerts <Link to='/alerts/archived'>here</Link>.
  </Message>
);

const NoAlerts = () => (
  <Message>
    <Message.Header>No new alerts.</Message.Header>
    <p>
      View archived alerts <Link to='/alerts/archived'>here</Link>.
    </p>
  </Message>
);

const NoArchivedAlerts = () => (
    <Message>
      <Message.Header>No archived alerts.</Message.Header>
    </Message>
);

const AlertList = ({alerts, refetchAlerts}) => (
  <div>
    {alerts.map(a => (<AlertItem key={a.id} {...a} refetchAlerts={refetchAlerts} />))}
  </div>
);


export default Alerts;