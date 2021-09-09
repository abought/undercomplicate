import {assert} from 'chai';

import {BaseAdapter, BaseUrlAdapter} from '../esm/adapter.js';


class TestCacheQuirks extends BaseAdapter {
    _getCacheKey(options) {
        return options.somevalue;
    }

    _performRequest(options) {
        // Return an object (not a string!) so that cache returns something at risk of being mutated
        return Promise.resolve([{ a: 1, b:2, c:3 }]);
    }

    _normalizeResponse(records, options) {
        // No parsing required
        return records;
    }

    _annotateRecords(records, options) {
        // Mutate the returned object, to confirm it doesn't mutate the contents of cache by shared reference
        records.forEach((row) => row.a += 1);
        return records;
    }
}

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

    it('intelligently clones non-string cache entries', function () {
        const source = new TestCacheQuirks();
        return source.getData({ somevalue: 1 })
            .then((result) => {
                assert.deepEqual(result, [{ a: 2, b:2, c:3 }], 'First cache check returns correct result');
                return source.getData({ somevalue: 1 });
            })
            .then((result) => assert.deepEqual(result, [{ a: 2, b:2, c:3 }], 'Second cache check returns correct result'));
    });
});

describe('BaseURLAdapter', function () {
    it('Requests throw an error when a URL is not provided', function () {
        const source = new BaseUrlAdapter({});
        assert.throws(
            () => source._performRequest({}),
            /must specify a resource URL/,
        );
    });
});
