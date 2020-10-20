'use strict';

exports.handler = async (event, context, callback) => {

    const domainName = event.domainName
    const sourceIP = event.identity.sourceIP

    if (sourceIP === '138.197.138.7' || domainName === 'www.s2maps.io' || domainName === 's2maps.io' || domainName === 'www.demo.s2maps.io' || domainName === 'de.s2maps.io') {
        const request = event.Records[0].cf.request;
        return callback(null, request);
    }

    // we did not find a reason to allow the request, so we deny it.

    const response = {
        status: '403',
        statusDescription: 'Forbidden',
        headers: {
            'vary':          [{ key: 'Vary',          value: '*' }], // hint, but not too obvious
            'cache-control': [{ key: 'Cache-Control', value: 'max-age=60' }], // browser-caching timer
            'content-type':  [{ key: 'Content-Type',  value: 'text/plain' }], // can't return binary (yet?)
        },
        body: 'Access Denied\n',
    };

    callback(null, response);
};
