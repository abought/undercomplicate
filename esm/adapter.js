import {LRUCache} from './lru_cache';


function difference(setA, setB) {
    // Set difference (a - b)
    let _difference = new Set(setA);
    for (let elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}


class BaseAdapter {
    constructor(config = {}) {
        this._config = config;
        const {
            // Cache control
            cache_enabled = true,
            cache_size = 3,
            // Adapters normally return data as rows of objects: [{field:value}]
            //  The list of expected fields can be declared, which will force schema validation
            validate_fields = false,
            fields = [], // Built in fields that every adapter must declare: the official spec
            extra_fields = [], // Sometimes, it is useful to instantiate "spec compliant" endpoints that add a few extra fields
        } = config;
        this._enable_cache = cache_enabled;
        this._cache = new LRUCache(cache_size);
        this._validate_fields = validate_fields;
        this._fields_contract = new Set(fields.concat(extra_fields));
        if (this._validate_fields && this._fields_contract.size === 0) {
            throw new Error('Fields validation requires declaring at least one expected field name in `config.fields[]`');
        }
    }

    _buildRequestOptions(options, dependent_data) {
        // Perform any pre-processing required that may influence the request. Receives an array with the payloads
        //  for each request that preceded this one in the dependency chain
        // This method may optionally take dependent data into account
        return Object.assign({}, options);
    }

    _getCacheKey(options) {
        /* istanbul ignore next */
        if (this._enable_cache) {
            throw new Error('Method not implemented');
        }
        return null;
    }

    /**
     * Perform the act of data retrieval (eg from a URL, blob, or JSON entity)
     * @param options
     * @returns {Promise}
     * @private
     */
    _performRequest(options) {
        /* istanbul ignore next */
        throw new Error('Not implemented');
    }

    _normalizeResponse(response_text, options) {
        // Convert the response format into a list of objects, one per datapoint. Eg split lines of a text file, or parse a blob of json.
        return response_text;
    }

    /**
     * Perform custom client-side operations on the retrieved data. For example, add calculated fields or
     *  perform rapid client-side filtering on cached data
     * @param records
     * @param {Object} options
     * @returns {*}
     * @private
     */
    _annotateRecords(records, options) {
        return records;
    }

    /**
     * A hook to transform the response after all operations are done. For example, this can be used to prefix fields
     *  with a namespace unique to the request, like assoc.log_pvalue. (that way, annotations and validation can happen
     *  on the actual API payload, without having to guess what the fields were renamed to).
     * @param records
     * @param options
     * @private
     */
    _postProcessResponse(records, options) {
        return records;
    }

    _validateResponseFields(records) {
        if (!records.length) {
            // A query can return 0 records without violating the fields contract
            return true;
        }

        // Assumption: All records have all required keys (missing values in the join will be marked as "null")
        // Note: it's ok for the adapter to return MORE fields than what we ask for.
        const response_keys = Object.keys(records[0]);
        const diffs = difference(this._fields_contract, new Set(response_keys));

        if (diffs.size) {
            throw new Error(`Provided response is missing expected fields: ${[...diffs]}`);
        }
        return true;
    }

    // Determine whether this adapter has declared a set of fields that could satisfy the provided request
    // This allows a visualization to ensure that the provided adapter could satisfy its requirements
    checkFieldsContract(provided, log = false) {
        if (!this._validate_fields) {
            throw new Error('This adapter does not support response validation');
        }
        provided = new Set(provided);
        const diffs = difference(provided, this._fields_contract);
        if (diffs.size && log) {
            console.error(`Adapter does not satisfy provided schema for fields: ${[...diffs]}`);
        }
        return diffs.size === 0;
    }

    getData(options = {}, ...dependent_data) {
        // Public facing method to define, perform, and process the request
        options = this._buildRequestOptions(options, ...dependent_data);

        // Then retrieval and parse steps: parse + normalize response, annotate
        const cache_key = this._getCacheKey(options);

        let result;
        if (this._enable_cache && this._cache.has(cache_key)) {
            result = this._cache.get(cache_key);
        } else {
            // Cache the promise (to avoid race conditions in conditional fetch). If the function `_getCacheKey`
            //  sets a special option value called _cache_meta, this will be used to annotate the cache entry
            // For example, this can be used to decide whether zooming into a view could be satisfied by a cache entry,
            //  even if the actual cache key wasn't an exact match
            result = this._performRequest(options);
            this._cache.add(cache_key, result, options._cache_meta);
        }

        return result.then((text) => this._normalizeResponse(text, options))
            .then((records) => this._annotateRecords(records, options))
            .then((records) => {
                if (this._validate_fields) {
                    this._validateResponseFields(records);
                }
                return this._postProcessResponse(records, options);
            });
    }
}


/**
 * Fetch data over the web
 */
class BaseUrlAdapter extends BaseAdapter {
    constructor(config) {
        super(config);

        const { url } = config;
        if (!url) {
            throw new Error('Web based resources must specify a resource URL as option "url"');
        }
        this._url = url;
    }


    // Default cache key is the URL for the request.
    _getCacheKey(options) {
        return this._getURL(options);
    }

    _getURL(options) {
        // Many resources will modify the URL to add query or segment parameters
        return this._url;
    }

    _performRequest(options) {
        const url = this._getURL(options);
        return fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            // In most cases, we store the response as text so that the copy in cache is clean (no mutable references)
            return response.text();
        });
    }

    _normalizeResponse(response_text, options) {
        if (typeof response_text === 'string') {
            return JSON.parse(response_text);
        }
        // Some custom usages will return an object directly; return that
        return response_text;
    }
}

export { BaseAdapter, BaseUrlAdapter };
