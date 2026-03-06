import RetrieveMetadataLoaderAsync from './retrieveMetadataLoaderAsync';

/**
 * Retrieve Study metadata from a DICOM server using the async loader.
 *
 * @param {*} dicomWebClient The DICOMWebClient instance to be used for series load
 * @param {*} StudyInstanceUID The UID of the Study to be retrieved
 * @param {object} filters Object containing filters to be applied on retrieve metadata process
 * @param {string} [filters.seriesInstanceUID] Series instance uid to filter results against
 * @param {function} [sortCriteria] Sort criteria function
 * @param {function} [sortFunction] Sort function
 *
 * @returns {Promise} A promises that resolves the study descriptor object
 */
async function RetrieveMetadata(
  dicomWebClient,
  StudyInstanceUID,
  filters = {},
  sortCriteria,
  sortFunction
) {
  const retrieveMetadataLoader = new RetrieveMetadataLoaderAsync(
    dicomWebClient,
    StudyInstanceUID,
    filters,
    sortCriteria,
    sortFunction
  );
  const data = await retrieveMetadataLoader.execLoad();

  return data;
}

export default RetrieveMetadata;
