import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql, Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { List, Icon, Loader } from 'semantic-ui-react'

const INSTALL_STATUS = gql`
  query InstallStatus {
    installStatus {
      steps {
        disp,
        messages,
        processing,
        complete,
        error
      }
    }
  }
`;

const INSTALL = gql`
  query installBro {
    installBro
  }
`;

class Messages extends Component {
  scrollToBottom() {
    if (this.messagesBottom) {
      this.messagesBottom.scrollIntoView({ behavior: 'smooth' });
    }
  }
  componentDidMount() {
    this.scrollToBottom();
  }
  componentDidUpdate() {
    this.scrollToBottom();
  }
  render() {
    return (
      <div style={{
        maxHeight: '200px',
        overflowY: 'scroll',
        fontSize: '0.8em'
      }}>
        { this.props.error && 
          <div style={{paddingTop: '10px'}}>
            <Icon name='warning sign' /> 
            {this.props.error}
          </div>
        }
        <pre>{this.props.messages}</pre>
        <div style={{float: 'left', clear: 'both'}}
          ref={el => this.messagesBottom = el}>
        </div>
      </div>         
    );
  }
}

const InstallBroSteps = () => (
  <Query query={INSTALL_STATUS} pollInterval={1000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <List divided verticalAlign='middle'>
        {data.installStatus.steps.map(s =>
          <List.Item key={s.disp} style={{overflowX: 'hidden'}}>
            { s.processing ?
              <Icon loading name='cog' style={{padding: '1px 0 0 0'}} /> :
              <Icon name='check' disabled={!s.complete} />
            }
            <List.Content style={{width: '100%'}}>
              <List.Header>{s.disp}</List.Header>
            </List.Content>
            { s.messages.length > 0 && (s.processing||s.error) &&
              <Messages {...s} />
            }
          </List.Item>    
        )}
        </List>
      );
    }}
  </Query>
);

const InstallBro = () => (
  <Query query={INSTALL}> 
    {() => { return (
      <InstallBroSteps />
    ); }}
  </Query>
);

export default InstallBro;
