import React, { Component } from "react";
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';
import { Button, Checkbox } from 'semantic-ui-react';

import { SPOOF_DEVICE, DEVICES, DEVICE } from './gql';

const Style = styled.div`
  display: inline-block;
  ._button {
    padding: 4px 6px;
  }
`;

const SpoofControl = ({
    style,
    type, 
    errorContent, 
    device: {mac, isSpoof, isSensor, isGateway, latestIp: { ip }}
  }) => (
  <Mutation 
    mutation={SPOOF_DEVICE}
    update={(cache, { data: {spoofDevice}}) => {
      try {
        const deviceQuery = cache.readQuery({ query: DEVICE, variables: { mac: mac } });
        deviceQuery.device = spoofDevice.devices.find(d => d.mac == mac);
        cache.writeQuery({ query: DEVICE, data: deviceQuery, variables: { mac: mac } });
      } catch (e) { /* error if device.mac not found, ignore */ }
      const query = cache.readQuery({ query: DEVICES });
      query.devices = spoofDevice.devices;
      cache.writeQuery({ query: DEVICES, data: query });
    }}
  > 
  {(spoofDevice, {data, loading}) => ( 
    <Style style={style}>
      {type == 'button' &&
        <Button 
          className="_button"
          content={isSpoof ? 'spoof: off' : 'spoof: on'} 
          size='mini' 
          loading={loading}
          disabled={loading}
          onClick={() => spoofDevice({ variables: { ip: ip, isSpoof: !isSpoof } })} 
        />
      }
      {type == 'toggle' &&
        <Checkbox 
          toggle 
          label='spoofing' 
          checked={isSpoof}
          disabled={isSensor||isGateway||loading}
          onChange={x => spoofDevice({ variables: { ip: ip, isSpoof: !isSpoof } })}
        />
      }
      { data && data.spoofDevice.spoofError && errorContent && errorContent(data.spoofDevice.spoofError) } 
    </Style> 
  )}
  </Mutation>
);

export default SpoofControl;
