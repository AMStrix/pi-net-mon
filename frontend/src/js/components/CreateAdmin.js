import React, { Component } from "react";
import ReactDOM from "react-dom";
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';
import { Button, Form, Segment, Message, Label, Icon } from 'semantic-ui-react'

class CreateAdmin extends Component {
  constructor() {
    super();
    this.state = {};
  }
  render() {
    return (
      <Form size='large' error={this.state.error ? true : false}>
          <Form.Input 
            fluid 
            icon='user' 
            iconPosition='left' 
            placeholder='Username' 
            onChange={e => this.setState({ user: e.target.value })}
          />
          <Form.Input 
            fluid
            placeholder='Password'
            type='password'
            icon='lock'
            iconPosition='left'
            onChange={e => this.setState({ pass: e.target.value })}
          />
          <Form.Input
            fluid
            icon={ this.state.passCheck === this.state.pass ? 'check' : 'warning' }
            iconPosition='left'
            placeholder='Password (again)'
            type='password'
            onChange={e => this.setState({ passCheck: e.target.value })}
          />
          <Button 
            color='teal' 
            fluid 
            size='large' 
            onClick={() => this.handleCreate()}
            disabled={!(this.state.user && this.state.pass && 
              (this.state.pass === this.state.passCheck))}
          >
            Create
          </Button>
          <Message
            error
            content={this.state.error}
          />
      </Form>
    );
  }
  async handleCreate() {
    this.setState({ error: null, waiting: true });
    const { user, pass } = this.state;
    let result;
    try {
      result = await this.props.mutate({
        variables: { user, pass }
      });
      if (result.data.createAdmin) {
        this.setState({ error: result.data.createAdmin });
      } else {
        this.setState({ adminCreated: true });
        this.props.onChange();
      }
    } catch (e) {
      console.log('ERROR', e);
    }
    this.setState({ waiting: false });
    //this.setState({ temperatureHistory, humidityHistory, fanHistoryTemp, fanHistoryHum });
  }
}

const CREATE_ADMIN = gql`
  mutation CreateAdmin($user: String!, $pass: String!) {
    createAdmin(user: $user, pass: $pass)
  }
`;

export default graphql(CREATE_ADMIN)(CreateAdmin);