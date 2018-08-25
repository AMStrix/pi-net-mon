import React, { Component } from "react";
import styled from 'styled-components';
import { Icon, Popup } from 'semantic-ui-react';
import _ from 'lodash';

import { lightBlue, gray } from '../colors';

const Style = styled.span`
  font-size: 0.9em;
`;

const TriggerStyle = styled.span`
  color: ${gray};
  :hover { 
    cursor: pointer;
    color: ${gray.darken(0.5)};
  }
  .content {
    margin-top: 0.2em;
  }
`;

const research = [
  { 
    name: 'talosintelligence.com',
    types: { ip: true, domain: true },
    url: x => `https://www.talosintelligence.com/reputation_center/lookup?search=${x}`
  },
  {
    name: 'cymon.io',
    types: { domain: true },
    url: dom => `https://cymon.io/domain/${dom}`
  },
  {
    name: 'cymon.io',
    types: { ip: true },
    url: ip => `https://cymon.io/${ip}`
  },
  {
    name: 'alienvault.com',
    types: { ip: true },
    url: ip => `https://otx.alienvault.com/indicator/ip/${ip}`
  },
  {
    name: 'alienvault.com',
    types: { domain: true },
    url: dom => `https://otx.alienvault.com/indicator/hostname/${dom}`
  },
  {
    name: 'virustotal.com',
    types: { ip: true },
    url: ip => `https://www.virustotal.com/en/ip-address/${ip}/information`
  },
  {
    name: 'virustotal.com',
    types: { domain: true },
    url: dom => `https://www.virustotal.com/en/domain/${dom}/information`
  }
];

const sourcesFor = (type, host) => {
  return research.filter(x => x.types[type]);
}

const Research = p => {

  return (
    <Style>
      <Popup 
        position={p.position}
        header='Research'
        trigger={<TriggerStyle><Icon name='flask' /></TriggerStyle>}
        content={Content(p.host, sourcesFor(p.type, p.host))}
        on='click'
      />
    </Style>
  );
}

const Content = (host, sources) => (
  <div className='content' >
    {sources.map(r => (
      <div key={r.name}>
        <a href={r.url(host)} target="_blank">{r.name}</a>
      </div>
    ))}
  </div>
);

export default Research;