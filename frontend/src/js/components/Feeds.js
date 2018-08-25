import _ from 'lodash';
import moment from 'moment';
import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Query, Mutation } from 'react-apollo';
import styled from 'styled-components';
import { Checkbox, Icon, Loader, Popup } from 'semantic-ui-react';

import { THREAT_FEEDS, ACTIVATE_THREAT_FEED } from './gql';
import Value from './Value';
import { gray, blue, orange } from '../colors';

const Style = styled.div`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  flex: 1;
  margin: 18px;
  .stats {
    width: 100%;
    margin-bottom: 1em;
  }
`;

const FeedStyle = styled.div`
  width: 250px;
  height: 70px;
  margin: 0 15px 15px 0;
  .sub {
    font-size: 0.8em;
    line-height: 1.3em;
    margin-left: 25px;
  }
  .feedError {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tags {
    .type, .rules {
      display: inline-block;
      color: white;
      padding: 0.0em 0.5em;
      border-radius: 0.7em;
      font-size: 0.8em;
      margin-right: 0.3em;
    }
    .type {
      background: ${gray.lighten(0.3)};
    }
    .rules {
      background: ${blue};
    }
  }
`;

class System extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  render() {
    return (
      <Feeds />
    );
  }
}


const Feeds = p => (
  <Query query={THREAT_FEEDS} pollInterval={10000} >
    {({loading, error, data: { threatFeeds }}) => {
      if (loading) return 'Loading...';
      if (error) return `Error! ${error.message}`;
      const sorted = _.sortBy(threatFeeds, ['description'])
        .filter(f => {
          const update = moment(f.lastupdate);
          const cutoff = new Date(Date.now() - 1000*60*60*24 * 365);
          return update.isAfter(cutoff);
        });
      const totalRuleCount = sorted.reduce((a, x) => (x.rulesCount||0) + a, 0);
      const activeFeedCount = sorted.reduce((a, x) => (x.active ? 1 : 0) + a, 0);
      return (
        <Style>
          <div className='stats'>
            <Value inline label='active feeds' value={activeFeedCount} />
            <Value inline label='active rules' value={totalRuleCount} />
          </div>
          {sorted.map(f => <Feed key={f.id} {...f} />)}
        </Style>
      );
    }}
  </Query>
);

const Feed = p => (
  <FeedStyle>
    <div>
      <Activate id={p.id} active={p.active} label={p.description} disabled={p.processing}/>
    </div>
    <div className='sub'>
      {p.processing && <div><Loader size='mini' inline active /> processing...</div>}
      <Tags {...p} />
      <FeedError {...p} />
      {!p.active && <div>isc.sans lastupdate {moment(p.lastupdate).format('M/D k:mm')}</div>}
      {p.active && p.lastPull && <div>last pull {moment(p.lastPull).format('M/D k:mm')}</div>}
      <Ignored {...p} />
    </div>
  </FeedStyle>
);

const FeedError = p => (
  p.active && p.error && 
  <Popup
    trigger={
      <div className='feedError'>
        <Icon name='warning circle'/>{p.error}
      </div>
    }
    content={<div><Icon name='warning circle'/>{p.error}</div>}
  />||null
);

const Tags = p => (
  <div className='tags'>
    <span className='type'>{p.datatype == 'is_ipv4' && 'ips' || 'domains'}</span>
    {p.active && !p.processing && <span className='rules'><b>{p.rulesCount}</b> rules</span>}
  </div>
);

const Ignored = p => p.ignored.length > 0 && 
  <Popup 
    trigger={<b>{p.ignored.length} ignored rules</b>}
    content={<div>{p.ignored.map(x => <div key={x}>{x}</div>)}</div>}
  /> || null;

const Activate = ({active, id, label, disabled}) => (
  <Mutation mutation={ACTIVATE_THREAT_FEED} >
    {(activateThreatFeed, {data, loading}) => (
      <Checkbox disabled={disabled} label={label} checked={active} onChange={
        x => x.preventDefault() || activateThreatFeed({ variables: { id: id, active: !active }})
      } />
    )}
  </Mutation>
);


export default System;