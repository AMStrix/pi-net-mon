import _ from 'lodash';
import React, { Component } from "react";
import { Query, Mutation } from 'react-apollo';
import { Button, Input, Form, Message } from 'semantic-ui-react';

import { NAME_DEVICE } from './gql';
window._ = _;
class ScanControl extends Component {
  state = { };
  componentDidMount() {
    this.props.focus && this.input.focus();
  }
  keyPress(e, nameDevice, mac, name) {
    e.keyCode == 13 && (nameDevice({ variables: { mac, name } }));
  }
  render() {
    const { style, mac } = this.props;
    return (
      <Mutation mutation={NAME_DEVICE} > 
      {(nameDevice, {data, loading}) => {
        const error = _.get(data, 'nameDevice.error');
        const success = _.get(data, 'nameDevice.device');
        success && this.props.onSuccess();
        return (
          <span style={style}>
            <Form>
              <Form.Field>
                <label>Device Name</label>
                <Input 
                  size='mini' 
                  error={error ? true : false}
                  loading={loading}
                  placeholder='Device Name' 
                  ref={x => (this.input = x)} 
                  onKeyDown={e => this.keyPress(e, nameDevice, mac, e.target.value)}
                />
                {error && <Message small negative content={error} />}
              </Form.Field>
            </Form>
          </span> 
        );
      }}
      </Mutation>
    );
  }
}


export default ScanControl;