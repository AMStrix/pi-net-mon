import React, { Component } from "react";
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import { Container, List, Icon, Card, Popup } from 'semantic-ui-react';
import moment from 'moment';

const DEVICES = gql`
  query devices {
    devices {
      mac,
      vendor,
      isSensor,
      ips {
        ip,
        seen
      }
    }
  }
`;

const Devices = () => (
  <Query query={DEVICES} pollInterval={5000}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <Container>
          <Card.Group stackable>
            {data.devices.map(d =>
              <Device key={d.mac} {...d} />
            )}
          </Card.Group>
        </Container>
      );
    }}
  </Query>
);

function latestIp(ips) {
  return ips.reduce((latest, ip) => {
    if (Date.parse(latest.seen) - Date.parse(ip.seen) > 0) {
      return latest;
    } else {
      return ip;
    }
  });
}

const Device = ({mac, ips, vendor, isSensor}) => (
  <Card>
    <Card.Content>
      <Card.Header>
        {isSensor && 
          <Popup trigger={<Icon name='eye' />} content='pi-net-mon sensor' />
        }   
        {mac}
      </Card.Header>
      <Card.Meta>
        <span>{latestIp(ips).ip}</span>
      </Card.Meta>
      <Card.Description>{vendor || '(no vendor discovered)'}</Card.Description>
    </Card.Content>
    <Card.Content extra>
      <a>
        <Icon name='clock' />
        { moment(latestIp(ips).seen).from(new Date()) }
      </a>
    </Card.Content>
  </Card>
);

export default Devices;