import {assert} from 'chai';

import {BaseAdapter} from '../esm/adapter.js';

class TestAdapter extends BaseAdapter {
    _buildRequestOptions(options, dependent_data) {
        const somevalue =  (dependent_data ? dependent_data.length : options.somevalue);
        return { somevalue };
    }

    _getCacheKey(options) {
        return options.somevalue;
    }

    _performRequest(options) {
        return Promise.resolve('line1\tcol2\nline2\tcol2');
    }

    _normalizeResponse(response_text, options) {
        return response_text.split('\n')
            .map((row) => {
                const [a, b] = row.split('\t');
                return {a, b};
            });
    }

    _annotateRecords(records, options) {
        records.forEach((row) => row.c = true);
        return records;
    }

    _postProcessResponse(records, options) {
        return records.map((record) => {
            return Object.keys(record).reduce((acc, akey) => {
                acc[`prefix.${akey}`] = record[akey];
                return acc;
            }, {});
        });
    }
}


describe('BaseAdapter', function () {
    it('performs a sequence of operations on retrieved data', function () {
        const source = new TestAdapter();
        return source.getData()
            .then((result) => {
                assert.deepEqual(result, [
                    {'prefix.a': 'line1', 'prefix.b': 'col2', 'prefix.c': true},
                    {'prefix.a': 'line2', 'prefix.b':'col2', 'prefix.c': true},
                ]);
            });
    });

    it('can consider dependent data when performing request', function () {
        const source = new TestAdapter();
        const base_options  = {somevalue: 12};

        // First trigger a request that leaves behind a trace of the default options
        return source.getData(base_options)
            .then((result) => {
                assert.ok(source._cache.has(12), 'Uses a cache value as given');

                // Then trigger a request that leaves behind a trace of using dependent data
                return source.getData(base_options, [1, 2, 3]);
            }).then((result) => {
                assert.ok(source._cache.has(3), 'Uses a cache value calculated from dependent data');
            });
    });

    it('uses a cache with configurable size', function () {
        const source = new TestAdapter({cache_size: 2});
        const requests = [1, 2, 3].map((item) => source.getData({somevalue: item}));
        return Promise.all(requests).then(() => {
            assert.equal(source._cache._cur_size, 2);
        });
    });

    it('validates that a declared adapter will meet an external contract', function () {
        const source = new TestAdapter({validate_fields: true, fields: ['a', 'd']});
        return source.getData()
            .then(() => assert.ok(false, 'Contract validation should fail'))
            .catch((e) => {
                assert.match(e.message, /missing expected fields/);
            });
    });

    it('allows adapter instances to declare additional fields of interest beyond the basic contract', function () {
        const source = new TestAdapter({validate_fields: true, fields: ['a', 'b'], extra_fields: ['c']});
        return source.getData().then((resp) => assert.ok('Schema validation passed'));
    });

    it('allows external providers to ask if adapter satisfies an expected contract', function () {
        const source = new TestAdapter({validate_fields: true, fields: ['a', 'b'], extra_fields: ['c']});

        let status = source.checkFieldsContract(['a', 'd'], false);
        assert.isNotOk(status, 'Requested contract does not match expected contract');

        status = source.checkFieldsContract(['a', 'c']);
        assert.isOk(status, 'Requested contract matches expected contract');
    });
});
