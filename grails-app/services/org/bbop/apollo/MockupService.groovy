package org.bbop.apollo

import grails.transaction.Transactional
import org.apache.shiro.crypto.hash.Sha256Hash

@Transactional
class MockupService {


    def addUsers() {
        if (User.count > 0) return
        def userRole = new Role(name: UserService.USER).save()
        userRole.addToPermissions("*:*")
        def adminRole = new Role(name: UserService.ADMIN).save()
        adminRole.addToPermissions("*:*")

        User demoUser = new User(username: "demo@demo.gov"
                , passwordHash: new Sha256Hash("demo").toHex()
        ).save()
        demoUser.addToRoles(userRole)

        User adminUser = new User(username: "admin@admin.gov"
                , passwordHash: new Sha256Hash("admin").toHex()
        ).save()
        adminUser.addToRoles(userRole)
    }

    /**
     * Repalce stuff in mapping.xml
     */
    def addTerms() {
        if (Term.count > 0) return
        new Term(term: "region", vocabulary: "sequence", readClass: "Region", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "gene", vocabulary: "sequence", readClass: "Gene", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "pseudogene", vocabulary: "sequence", readClass: "Pseudogene", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "transcript", vocabulary: "sequence", readClass: "Transcript", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "mRNA", vocabulary: "sequence", readClass: "MRNA", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "tRNA", vocabulary: "sequence", readClass: "TRNA", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "snRNA", vocabulary: "sequence", readClass: "SnRNA", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "snoRNA", vocabulary: "sequence", readClass: "SnoRNA", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "ncRNA", vocabulary: "sequence", readClass: "NcRNA", type: TermTypeEnum.FEATURE_MAPPING).save()
        new Term(term: "rRNA", vocabulary: "sequence", readClass: "RRNA", type: TermTypeEnum.FEATURE_MAPPING).save()

        // and several many more
    }

    def addGenomes() {
        if (Genome.count > 0) return

        Genome genome1 = new Genome(name: "Danio rerio").save()
        Sequence track1 = new Sequence(name: "Zebrafish Track 1", organismName: "Bunny Foofo"
                , sequenceCV: "sequence", sequenceType: "mRNA"
                , refSeqFile: "/opt/apollo/jbrowse/data/seq/refSeqs.json"
                , dataDirectory: "/opt/apollo/jbrowse/data"
//                ,translationTableLocation:
        ).save()
//        Track track2 = new Track(name: "Zebrafish Track 2").save()
        genome1.addToTracks(track1)
//        genome1.addToTracks(track2)

        User demoUser = User.findByUsername("demo@demo.gov")
        User adminUser = User.findByUsername("admin@admin.gov")

        track1.addToUsers(demoUser)
        track1.addToUsers(adminUser)

//        Genome genome2 = new Genome(name: "Caenorhabditis elegans").save()
//        Track track3 = new Track(name: "Celegans Track 1").save()
//        genome2.addToTracks(track3)
//        track3.addToUsers(demoUser)
//
//        track3.save(flush:true)
    }

    // {"data_adapters":[{"permission":1,"key":"GFF3","options":"output=file&format=gzip"},
    // {"permission":1,"key":"FASTA","data_adapters":
    // [{"permission":1,"key":"peptide","options":"output=file&format=gzip&seqType=peptide"}
    // ,{"permission":1,"key":"cDNA","options":"output=file&format=gzip&seqType=cdna"}
    // ,{"permission":1,"key":"CDS","options":"output=file&format=gzip&seqType=cds"}]}]}
    def addDataAdapters() {
        if (DataAdapter.count > 0) return
        new DataAdapter(permission: 1, key: "GFF3", options: "output=file&format=gzip").save()
        DataAdapter fastaDataAdapter = new DataAdapter(permission: 1, key: "FASTA").save(failOnError: true,flush: true)
        DataAdapter peptideFastaDataAdapater = new DataAdapter(permission: 1, key: "peptide", options: "output=file&format=gzip&seqType=peptide").save()
        DataAdapter cDNAFastaDataAdapater = new DataAdapter(permission: 1, key: "cDNA", options: "output=file&format=gzip&seqType=cdna").save()
        DataAdapter cdsFastaDataAdapater = new DataAdapter(permission: 1, key: "cDNA", options: "output=file&format=gzip&seqType=cds").save()
        fastaDataAdapter.addToDataAdapters(peptideFastaDataAdapater)
        fastaDataAdapter.addToDataAdapters(cDNAFastaDataAdapater)
        fastaDataAdapter.addToDataAdapters(cdsFastaDataAdapater)
    }
}
