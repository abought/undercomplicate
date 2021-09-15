# Undercomplicate

_"You should have seen the alternative"_

A simple library for retrieving heterogeneous and interdependent data

## Motivation
When working with sensitive data from multiple sources, it is not always possible to load and join data on the server side- for example, the data may not all be on one server! Sometimes, a group of API requests must be performed, with joins to be performed on the client side.

_Undercomplicate_ is a data retrieval library that handles retrieving data from heterogenous sources. It manages dependencies so that requests are parallelized when possible, or performed sequentially if necessary. Each part of the request lifecycle can be customized to encourage code reuse, and various customizable cache behaviors are possible.

The package has been written with research tools like [LocusZoom.js](https://github.com/statgen/locuszoom) in mind. Our goal is to provide a reusable way to request and use data, even though research groups do not always use the same nomenclature or storage / data / API response formats. If you are able to store your data in a well-defined relational schema, please do that! But if your storage is too big and decentralized for SQL, the dependency management and client-side join logic in this library may be of use.  

**Key features:**

- Adapters:
  - Fetch data and normalize it to a standard form (usually an array in which each item is an object of {field:value} pairs for one row of data)
  - Subclassable, with fine control of data retrieval and formatting. For example, an adapter can perform the same calculation using either local or remote data.
  - LRU cache with configurable size allows pages to respond smoothly when switching between multiple views
- Dependency resolution: 
  - When multiple kinds of data are requested, it will parallelize the requests if possible
  - When a dependency is specified, requests will receive the data they depend on, and can use this to construct the next request. For example, "given a query, find the most significant result, then query the server for related information about that item".
- Client side join functions (left, inner, full outer) can be used to make connections between retrieved data
