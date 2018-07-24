import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Route, Switch, Redirect } from 'react-router-dom';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';

import c from '../colors';
import Menu from './Menu';
import Install from './Install';
import Dashboard from './Dashboard';
import Devices from './Devices';
import Hosts from './Hosts';
import Login from './Login';

const Wrapper = styled.div`
  display: flex;
  min-height: 100%;
`;

const MenuWrapper = styled.div`
  overflow-y: scroll;
  overflow-x: hidden;
`;
const ContentWrapper = styled.div`
  background: ${c.background};
  display: flex;
  flex: 1;
  padding-left: 200px;
`;

class App extends Component {
  constructor() {
    super();
    this.state = {};
  }
  render() {
    if (this.props.status && this.props.status.loading) {
      return <div>Loading...</div>;
    }

    if (this.props.status && this.props.status.error) {
      return <div>status query error</div>;
    }
    let isInstall = 
      !this.props.status.installStatus.hasAdmin || 
      !this.props.status.installStatus.hasBro;
    let authed = this.props.status.status.authed;
    return (
      <Wrapper>
        <MenuWrapper>
          <Menu />
        </MenuWrapper>
        <ContentWrapper>
          <Switch>
            <Route 
              path='/install' 
              render={p => <Install {...p} {...this.props.status.installStatus} />}  
            />
            {isInstall &&  <Redirect to='/install' /> }
            <Route
              path='/login'
              render={() => <Login {...this.props.status.status} />}
            />
            {!authed && <Redirect to='/login' /> }
            <Route exact path='/' component={Dashboard} />
            <Route path='/devices' component={Devices} />
            <Route path='/hosts' component={Hosts} />
          </Switch>
        </ContentWrapper>
      </Wrapper>
    );
  }
  handleInstallChange() {
    this.props.status.refetch();
  }
}

const STATUS = gql`
  query Status {
    installStatus {
      hasAdmin,
      hasBro
    }
    status {
      authed
    }
  }
`;

export default graphql(
  STATUS, 
  { 
    name: 'status', 
    options: { /*pollInterval: 10000*/ }
  }
) (App);