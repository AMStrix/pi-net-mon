import React, { Component } from "react";
import { Mutation } from 'react-apollo';
import { Redirect, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, Icon, Popup } from 'semantic-ui-react';
import moment from 'moment';

import Seen from './Seen';
import { green, gray, orange, level } from '../colors';
import { ALERTS, ALERT_ACTION } from './gql';
import Research from './Research';

const Style = styled.div`
  position: relative;
  display: flex;
  padding: 4px;
  cursor: pointer;
  border-bottom: 1px solid ${gray.lighten(0.8)};
  .controls {
    display: none;
  }
  :hover {
    background: ${gray.lighten(0.8)};
    .controls {
      display: flex;
    }
  }
`;
const DeetsStyle = styled.div`
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  .icon {
    margin: 0 0.4em;
  }
  a:hover {
    text-decoration: underline;
  }
`;
const TimeStyle = styled.div`
  color: ${gray};
  font-size: 0.8em;
`;
const DotStyle = styled.div`
  color: ${p => level(p.level/10)};
`;
const ControlsStyle = styled.div`
  display: flex;
  align-items: center;
  padding: 0 1em;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  background: ${gray.darken(0.2)};
  > button.ui.button + button.ui.button {
    margin-left: 0.8em;
  }
`;

class AlertItem extends Component {
  state = { now: new Date() };
  componentDidMount() {
    this.intervalId = setInterval(() => this.setState({ now: new Date() }), 10000);
  }
  componentWillUnmount() {
    clearInterval(this.intervalId);
  }
  handleClick(e) {
    this.setState({ redirect: '/devices/' + this.props.mac });
  }
  render() {
    const p = this.props;
    if (this.state.redirect) return <Redirect push to={this.state.redirect} />;
    return (
      <Style onClick={this.handleClick.bind(this)}>
        <Dot {...p} />
        <Deets {...p} />
        <TimeStyle>
          {moment(p.time).from(this.state.now)}
          &nbsp;&nbsp;
          {moment(p.time).format('MM/DD kk:mm')}
        </TimeStyle>
        <Controls {...p} />
      </Style>
    );
  }
}

const Deets = p => (
  <DeetsStyle>
    <Desc {...p} />
    <Link to={'/devices/' + p.mac}>{p.deviceName || p.mac}</Link>
    <Icon name='long arrow alternate right' />
    {p.domainThreat && 
      <Link to={'/hosts/' + p.domain}>{p.domain}</Link> ||
      <span onClick={e => e.stopPropagation()}>
        {p.ip}<Research type='ip' host={p.ip} position='right center' />
        {p.domain && <Link to={'/hosts/' + p.domain}>({p.domain})</Link>}
      </span>
    }
  </DeetsStyle>
);

const getFeedDesc = alert => 
  (alert.domainThreat && alert.domainThreat.feed) ||
  (alert.ipThreat && alert.ipThreat.feed) ||
  null;
const threatFeedType = alert => 
  (alert.domainThreat && 'domain') ||
  (alert.ipThreat && 'ip') ||
  null;
const getThreatDesc = alert => <span>Threat feed <b>{threatFeedType(alert)}</b> rule match</span>;
const Desc = p => {
  if (p.type == 'threatFeedMatch') {
    return <div>{getThreatDesc(p)} from <b>{getFeedDesc(p)}</b></div>;
  }
  return null;
}

const Dot = ({level}) => (
  <DotStyle level={level}>
    <Icon name='circle' />
  </DotStyle>
);


const alertActionUpdate = (cache, { data }) => {
  const query = cache.readQuery({ query: ALERTS });
  query.alerts = data.alertAction;
  cache.writeQuery({ query: ALERTS , data: query });
}
const Controls = p => (
    <Mutation mutation={ALERT_ACTION} update={alertActionUpdate} >
      {(alertAction, { data, loading }) => (
        <ControlsStyle className='controls' onClick={e => e.stopPropagation()}>
          <Button 
            content='archive'
            size='mini' 
            onClick={() => alertAction({ variables: { id: p.id, action: 'archive'}})}
            disabled={loading}
          />
          <Button 
            content='delete'
            size='mini' 
            onClick={() => alertAction({ variables: { id: p.id, action: 'delete'}})}
            disabled={loading}
          />
          <Button 
            content='ignore'
            size='mini' 
            onClick={() => alertAction({ variables: { id: p.id, action: 'ignore'}})}
            disabled={loading}
          />
        </ControlsStyle>
      )}
    </Mutation>
);


export default AlertItem;