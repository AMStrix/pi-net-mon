import _ from 'lodash';
import moment from 'moment';
import React, { Component } from "react";
import ReactDOM from "react-dom";
import { Query, Mutation } from 'react-apollo';
import styled from 'styled-components';
import { Checkbox, Icon, Loader } from 'semantic-ui-react'

import { THREAT_FEEDS, ACTIVATE_THREAT_FEED } from './gql';
import Value from './Value';

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
    <div><Activate id={p.id} active={p.active} label={p.description} disabled={p.processing}/></div>
    <div className='sub'>
      {p.processing && <div><Loader size='mini' inline active /> processing...</div>}
      {p.active && p.error && <div><Icon name='warning circle'/> {p.error}</div>}
      {!p.active && <div>isc.sans lastupdate: {moment(p.lastupdate).format('M/D k:mm')}</div>}
      {p.active && p.lastPull && <div>last pull: {moment(p.lastPull).format('M/D k:mm')}</div>}
      {p.active && !p.processing && <div><b>active rules: {p.rulesCount}</b></div>}
    </div>
  </FeedStyle>
)

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