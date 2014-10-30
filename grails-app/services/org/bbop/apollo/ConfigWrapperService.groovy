package org.bbop.apollo

import grails.transaction.Transactional
import org.bbop.apollo.sequence.Overlapper
import org.bbop.apollo.sequence.SequenceTranslationHandler
import org.bbop.apollo.sequence.TranslationTable

/**
 * TODO:  move all of this stuff to a database
 */
@Transactional
class ConfigWrapperService {

    def grailsApplication


    Boolean useCDS() {
        return grailsApplication.config.apollo.use_cds_for_new_transcripts
    }

    TranslationTable getTranslationTable() {
        SequenceTranslationHandler.getTranslationTableForGeneticCode(getTranslationCode())
        return grailsApplication.config.apollo.translation_table
    }

    int getTranslationCode(){
        return grailsApplication.config.apollo.get_translation_code
    }

    Overlapper getOverlapper(){
        (Overlapper) Class.forName(grailsApplication.config.apollo.overlapper_class).newInstance();
    }
}
