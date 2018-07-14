import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Route, Switch } from 'react-router-dom';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

import c from '../colors';
import styled from 'styled-components';
import Menu from './Menu';
import Install from './Install';
import Dashboard from './Dashboard';
import Devices from './Devices';

const Wrapper = styled.div`
  height: 100%;
  background: ${c.background};
`;

const MenuWrapper = styled.div`
  overflow-y: scroll;
  overflow-x: hidden;
`;
const ContentWrapper = styled.div`
  height: 100%;
  margin-left: 250px;
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
    return (
      <Wrapper>
        <MenuWrapper>
          <Menu />
        </MenuWrapper>
        <ContentWrapper>
          <Switch>
            <Route exact path='/' component={Dashboard} />
            <Route path='/devices' component={Devices} />
            <Route path='/install' component={Install} />
          </Switch>
        </ContentWrapper>
      </Wrapper>
    );
  }
  handleInstallChange() {
    this.props.status.refetch();
  }
}
/*
        {isInstall && 
          <Install {...this.props.status.installStatus} 
            onChange={this.handleInstallChange.bind(this)} 
          />
        }

          <MenuWrapper>
            {!isInstall && <Menu />}
          </MenuWrapper>
          <ContentWrapper>
            {!isInstall && <Devices />}
          </ContentWrapper>
*/

const STATUS = gql`
  query Status {
    installStatus {
      hasAdmin,
      hasBro
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