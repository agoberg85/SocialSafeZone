// static/campaign-pdf.js
// PDF Generation Module for Campaign Spec Sheets

window.CampaignPDF = {
    
    // Generate and download PDF spec sheet
    generate: async function(campaign, selectedFormats, supabaseClient) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        let yPos = margin;

        // Helper function to check if we need a new page
        const checkNewPage = (neededSpace) => {
            if (yPos + neededSpace > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
                return true;
            }
            return false;
        };

        // HEADER
        this.renderHeader(doc, campaign, margin, pageWidth);
        yPos += 40;

        // CAMPAIGN SUMMARY
        const summaryHeight = this.renderSummary(doc, selectedFormats, margin, pageWidth, yPos);
        yPos += summaryHeight;

        // GROUP BY PLATFORM AND FORMAT
        const grouped = this.groupFormats(selectedFormats);

        // RENDER EACH FORMAT GROUP
        for (const group of Object.values(grouped)) {
            // Fetch format data for reference link only
            let formatData = null;
            if (!group.creatives[0].is_custom) {
                formatData = await this.fetchFormatSpecs(group.platform, group.format, supabaseClient);
            }

            checkNewPage(35);

            yPos = this.renderFormatGroup(doc, group, formatData, margin, pageWidth, pageHeight, yPos, checkNewPage);
        }

        // FOOTER
        this.renderFooter(doc, pageWidth, pageHeight, margin);

        // SAVE PDF
        const filename = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_Spec_Sheet.pdf`;
        doc.save(filename);
        alert('Spec sheet generated successfully!');
    },

    // Render PDF header
    renderHeader: function(doc, campaign, margin, pageWidth) {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Campaign Specification Sheet', margin, margin);
        
        let yPos = margin + 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);
        doc.text(`Campaign: ${campaign.name}`, margin, yPos);
        yPos += 6;

        if (campaign.client_name) {
            doc.text(`Client: ${campaign.client_name}`, margin, yPos);
            yPos += 6;
        }

        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        doc.text(`Generated: ${date}`, margin, yPos);
        yPos += 8;

        // Campaign Description
        if (campaign.description) {
            doc.setFontSize(9);
            doc.setTextColor(80);
            const descLines = doc.splitTextToSize(campaign.description, pageWidth - margin * 2);
            doc.text(descLines, margin, yPos);
            yPos += descLines.length * 4 + 5;
        }

        // Divider
        doc.setDrawColor(200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
    },

    // Render campaign summary
    renderSummary: function(doc, selectedFormats, margin, pageWidth, yPos) {
        let totalBudget = 0;
        let totalImpressions = 0;
        let totalReach = 0;
        let creativesWithData = 0;

        selectedFormats.forEach(format => {
            if (format.budget) totalBudget += parseFloat(format.budget);
            if (format.impressions) totalImpressions += parseInt(format.impressions);
            if (format.reach) totalReach += parseInt(format.reach);
            if (format.budget || format.impressions || format.reach) creativesWithData++;
        });

        if (creativesWithData === 0) {
            return 10; // Just add some spacing
        }

        doc.setFillColor(245, 247, 250);
        doc.rect(margin, yPos - 3, pageWidth - margin * 2, 16, 'F');
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Campaign Summary', margin + 3, yPos + 2);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);
        
        const summaryParts = [];
        if (totalBudget > 0) summaryParts.push(`Total Budget: kr${totalBudget.toLocaleString()}`);
        if (totalImpressions > 0) summaryParts.push(`Total Impressions: ${totalImpressions.toLocaleString()}`);
        if (totalReach > 0) summaryParts.push(`Total Reach: ${totalReach.toLocaleString()}`);
        
        doc.text(summaryParts.join(' • '), margin + 3, yPos);
        
        return 22; // Height of summary section
    },

    // Group formats by platform and format name
    groupFormats: function(selectedFormats) {
        const grouped = {};
        selectedFormats.forEach(format => {
            const key = `${format.platform}|||${format.format}`;
            if (!grouped[key]) {
                grouped[key] = {
                    platform: format.platform,
                    format: format.format,
                    creatives: []
                };
            }
            grouped[key].creatives.push(format);
        });
        return grouped;
    },

    // Fetch format specifications from database
    fetchFormatSpecs: async function(platform, formatName, supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('platform_formats')
                .select('*')
                .eq('platform', platform)
                .eq('format_name', formatName)
                .maybeSingle();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching format specs:', error);
            return null;
        }
    },

    // Render a format group
    renderFormatGroup: function(doc, group, formatData, margin, pageWidth, pageHeight, yPos, checkNewPage) {
        // Platform/Format Header
        doc.setFillColor(102, 126, 234);
        doc.rect(margin, yPos - 2, pageWidth - margin * 2, 8, 'F');
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        
        const headerText = group.platform === 'Custom' 
            ? `${group.format} (Custom Format)` 
            : `${group.platform} - ${group.format}`;
        doc.text(headerText, margin + 3, yPos + 4);
        yPos += 12;

        // Format info (dimensions + reference link)
        yPos = this.renderFormatInfo(doc, group, formatData, margin, yPos);

        // Creatives list
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`Creatives (${group.creatives.length}):`, margin + 3, yPos);
        yPos += 6;

        // Render each creative
        group.creatives.forEach((creative) => {
            checkNewPage(30);
            yPos = this.renderCreative(doc, creative, margin, pageWidth, yPos);
        });

        yPos += 6; // Space between format groups
        return yPos;
    },

    // Render format info (dimensions and link)
    renderFormatInfo: function(doc, group, formatData, margin, yPos) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);

        let infoLine = '';
        
        // Dimensions
        if (group.creatives[0].is_custom) {
            infoLine = `${group.creatives[0].custom_width}×${group.creatives[0].custom_height}px`;
        } else if (formatData) {
            infoLine = `${formatData.width}×${formatData.height}px`;
            if (formatData.aspect_ratio) {
                infoLine += ` (${formatData.aspect_ratio})`;
            }
        }

        doc.text(infoLine, margin + 3, yPos);
        yPos += 5;

        // Reference link if available
        if (formatData && formatData.reference_link) {
            doc.setFontSize(8);
            doc.setTextColor(80);
            
            // Label
            doc.text('File specs: ', margin + 3, yPos);
            
            // Get label width
            const labelWidth = doc.getTextWidth('File specs: ');
            
            // Clickable URL in blue
            doc.setTextColor(102, 126, 234);
            doc.textWithLink(formatData.reference_link, margin + 3 + labelWidth, yPos, { url: formatData.reference_link });
            
            doc.setTextColor(80);
            yPos += 7;
        } else {
            yPos += 2;
        }

        return yPos;
    },

    // Render a single creative
    renderCreative: function(doc, creative, margin, pageWidth, yPos) {
        const typeLabels = { 
            'image': '[IMAGE]', 
            'video': '[VIDEO]', 
            'other': '[FILE]' 
        };
        const typeLabel = typeLabels[creative.creative_type] || '[IMAGE]';
    
        // Creative header with checkbox
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
    
        // Checkbox
        doc.rect(margin + 5, yPos - 2, 3, 3);
    
        // Type + Name + Duration (if video)
        let creativeLine = `${typeLabel} ${creative.creative_name}`;
        if (creative.creative_type === 'video' && creative.duration) {
            creativeLine += ` (${creative.duration})`;
        }
        doc.text(creativeLine, margin + 10, yPos);
        yPos += 5;

        // Description (if present)
        if (creative.creative_description) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80);
            const descLines = doc.splitTextToSize(creative.creative_description, pageWidth - margin - 15);
            doc.text(descLines, margin + 10, yPos);
            yPos += descLines.length * 3 + 2;
        }

        // Media planning data
        const hasMediaData = creative.placement || creative.budget || creative.start_date || 
                            creative.impressions || creative.reach || creative.cpm || 
                            creative.frequency || creative.notes;

        if (hasMediaData) {
            yPos = this.renderMediaPlanningData(doc, creative, margin, pageWidth, yPos);
        }

        yPos += 3; // Space between creatives
        return yPos;
    },

    // Render media planning data for a creative
    renderMediaPlanningData: function(doc, creative, margin, pageWidth, yPos) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);

        // Period
        if (creative.start_date || creative.end_date) {
            let dateStr = 'Period: ';
            if (creative.start_date) dateStr += creative.start_date;
            if (creative.start_date && creative.end_date) dateStr += ' to ';
            if (creative.end_date) dateStr += creative.end_date;
            doc.text(dateStr, margin + 10, yPos);
            yPos += 3.5;
        }

        // Placement
        if (creative.placement) {
            const placementLines = doc.splitTextToSize(`Placement: ${creative.placement}`, pageWidth - margin - 15);
            doc.text(placementLines, margin + 10, yPos);
            yPos += placementLines.length * 3.5;
        }

        // Metrics in one line
        const metrics = [];
        if (creative.budget) metrics.push(`Budget: kr${creative.budget.toLocaleString()}`);
        if (creative.impressions) metrics.push(`Imp: ${creative.impressions.toLocaleString()}`);
        if (creative.reach) metrics.push(`Reach: ${creative.reach.toLocaleString()}`);
        if (creative.cpm) metrics.push(`CPM: kr${creative.cpm}`);
        if (creative.frequency) metrics.push(`Freq: ${creative.frequency}`);

        if (metrics.length > 0) {
            doc.text(`Metrics: ${metrics.join(' • ')}`, margin + 10, yPos);
            yPos += 3.5;
        }

        // Notes (if any)
        if (creative.notes) {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100);
            const notesLines = doc.splitTextToSize(`Notes: ${creative.notes}`, pageWidth - margin - 15);
            doc.text(notesLines, margin + 10, yPos);
            yPos += notesLines.length * 3.5;
        }

        yPos += 2;
        return yPos;
    },

    // Render footer on all pages
    renderFooter: function(doc, pageWidth, pageHeight, margin) {
        const footerY = pageHeight - 10;
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'italic');

        const pageCount = doc.internal.pages.length - 1;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text('Generated by SafeZoneGuide', pageWidth / 2, footerY, { align: 'center' });
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
        }
    }
};
